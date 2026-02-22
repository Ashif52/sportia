/**
 * Spin Wheel Module
 * Canvas-based spin wheel for random player or team selection.
 * Two modes: Player Picker and Team Picker.
 * Control roles only can spin.
 */
const SpinWheelModule = (() => {
    'use strict';

    let _container = null;
    let _canvas = null;
    let _ctx = null;
    let _mode = 'player'; // player | team
    let _spinning = false;
    let _rotation = 0;
    let _items = [];
    let _result = null;

    const COLORS = [
        '#6366f1', '#f59e0b', '#16a34a', '#dc2626', '#8b5cf6', '#0ea5e9',
        '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#84cc16', '#a855f7',
    ];

    function init(container) {
        _container = container;
        EventBus.subscribe(Events.STATE_RESET, render);
    }

    function render() {
        if (!_container) return;
        const isControl = Auth.isControlRole();

        _container.innerHTML = `
            <div class="spin-container">
                <!-- Mode Selector -->
                <div class="spin-mode-selector">
                    <button class="spin-mode-btn ${_mode === 'player' ? 'active' : ''}" data-spin-mode="player">🏏 Player</button>
                    <button class="spin-mode-btn ${_mode === 'team' ? 'active' : ''}" data-spin-mode="team">👥 Team</button>
                </div>

                <!-- Wheel -->
                <div class="spin-wheel-wrapper">
                    <div class="spin-pointer"></div>
                    <canvas class="spin-wheel-canvas" id="spin-canvas" width="400" height="400"></canvas>
                </div>

                <!-- Spin Button -->
                ${isControl ? `
                <button class="btn btn--primary btn--lg control-only" id="btn-spin" ${_spinning ? 'disabled' : ''}>
                    🎯 ${_spinning ? 'Spinning...' : 'Spin the Wheel'}
                </button>
                ` : `
                <p class="text-muted" style="font-size:0.85rem;">Only auctioneers can spin the wheel</p>
                `}

                <!-- Result -->
                <div class="spin-result" id="spin-result">
                    ${_result ? `
                        <div class="spin-result__label">Selected</div>
                        <div class="spin-result__value">${_result}</div>
                    ` : ''}
                </div>
            </div>
        `;

        _canvas = document.getElementById('spin-canvas');
        if (_canvas) {
            _ctx = _canvas.getContext('2d');
            _loadItems();
            _drawWheel();
        }

        _bindEvents();
    }

    function _loadItems() {
        const state = AppState.getState();
        if (_mode === 'player') {
            _items = state.players
                .filter(p => p.status === 'available')
                .map(p => ({ id: p.id, label: p.name, color: COLORS[_items.length % COLORS.length] }));
        } else {
            _items = state.teams.map((t, i) => ({ id: t.id, label: t.name, color: t.color || COLORS[i % COLORS.length] }));
        }

        // Assign colors
        _items.forEach((item, i) => {
            if (_mode === 'player') item.color = COLORS[i % COLORS.length];
        });
    }

    function _drawWheel() {
        if (!_ctx || _items.length === 0) {
            _drawEmptyWheel();
            return;
        }

        const cx = 200, cy = 200, r = 180;
        const sliceAngle = (2 * Math.PI) / _items.length;

        _ctx.clearRect(0, 0, 400, 400);
        _ctx.save();
        _ctx.translate(cx, cy);
        _ctx.rotate(_rotation);
        _ctx.translate(-cx, -cy);

        _items.forEach((item, i) => {
            const startAngle = i * sliceAngle;
            const endAngle = startAngle + sliceAngle;

            // Draw slice
            _ctx.beginPath();
            _ctx.moveTo(cx, cy);
            _ctx.arc(cx, cy, r, startAngle, endAngle);
            _ctx.closePath();
            _ctx.fillStyle = item.color;
            _ctx.fill();
            _ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            _ctx.lineWidth = 2;
            _ctx.stroke();

            // Draw label
            _ctx.save();
            _ctx.translate(cx, cy);
            _ctx.rotate(startAngle + sliceAngle / 2);
            _ctx.fillStyle = '#fff';
            _ctx.font = `bold ${_items.length > 12 ? '10' : _items.length > 8 ? '11' : '13'}px Inter, sans-serif`;
            _ctx.textAlign = 'right';
            _ctx.textBaseline = 'middle';

            // Truncate label if needed
            let label = item.label;
            if (label.length > 12) label = label.slice(0, 10) + '…';
            _ctx.fillText(label, r - 14, 0);
            _ctx.restore();
        });

        // Center circle
        _ctx.beginPath();
        _ctx.arc(cx, cy, 28, 0, 2 * Math.PI);
        _ctx.fillStyle = '#1e293b';
        _ctx.fill();
        _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        _ctx.lineWidth = 3;
        _ctx.stroke();

        // Center text
        _ctx.fillStyle = '#fff';
        _ctx.font = 'bold 12px Inter, sans-serif';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText('AYN', cx, cy);

        _ctx.restore();
    }

    function _drawEmptyWheel() {
        if (!_ctx) return;
        _ctx.clearRect(0, 0, 400, 400);
        _ctx.beginPath();
        _ctx.arc(200, 200, 180, 0, 2 * Math.PI);
        _ctx.fillStyle = 'var(--c-bg-alt)';
        _ctx.fill();
        _ctx.fillStyle = '#94a3b8';
        _ctx.font = '16px Inter, sans-serif';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText('No items to display', 200, 200);
    }

    function _spin() {
        if (_spinning || _items.length === 0) return;
        _spinning = true;
        _result = null;

        const spinDuration = 4000 + Math.random() * 2000;
        const totalRotation = (5 + Math.random() * 5) * 2 * Math.PI;
        const startRotation = _rotation;
        const startTime = Date.now();

        function animate() {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / spinDuration, 1);

            // Ease-out cubic
            const eased = 1 - Math.pow(1 - progress, 3);
            _rotation = startRotation + totalRotation * eased;

            _drawWheel();

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                _spinning = false;
                _determineResult();
                render();
            }
        }

        animate();

        // Update button state
        const btn = document.getElementById('btn-spin');
        if (btn) {
            btn.disabled = true;
            btn.textContent = '🎯 Spinning...';
        }
    }

    function _determineResult() {
        if (_items.length === 0) return;

        const sliceAngle = (2 * Math.PI) / _items.length;
        // The pointer is at the top (90 degrees / π/2 radians from right)
        const normalizedRotation = ((Math.PI * 1.5 - _rotation) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
        const index = Math.floor(normalizedRotation / sliceAngle) % _items.length;

        _result = _items[index]?.label || 'Unknown';

        AppState.addLog({
            type: 'spin',
            message: `Spin Wheel selected: ${_result} (${_mode === 'player' ? 'Player' : 'Team'})`,
            icon: '🎯',
        });

        App.showToast(`Selected: ${_result}`, 'info');
    }

    function _bindEvents() {
        // Mode selector
        _container?.querySelectorAll('[data-spin-mode]').forEach(btn => {
            btn.addEventListener('click', () => {
                _mode = btn.dataset.spinMode;
                _result = null;
                _rotation = 0;
                render();
            });
        });

        // Spin button
        document.getElementById('btn-spin')?.addEventListener('click', _spin);
    }

    return { init, render };
})();
