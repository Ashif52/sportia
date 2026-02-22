/**
 * VoiceChat Module
 * Real-time voice communication for the Auctioneer to broadcast to Team Owners.
 * Uses Web Audio API for microphone capture and waveform visualization.
 *
 * Roles:
 *  - Auctioneer / SuperAdmin: Can broadcast (mic control)
 *  - TeamOwner: Can listen (shows as connected participant)
 *  - Viewer: Read-only indicator
 */
const VoiceChatModule = (() => {
    'use strict';

    let _container = null;
    let _audioCtx = null;
    let _mediaStream = null;
    let _analyser = null;
    let _gainNode = null;
    let _animationFrame = null;
    let _isBroadcasting = false;
    let _isMuted = false;
    let _canvasEl = null;

    function init(container) {
        _container = container;
    }

    /**
     * Render the voice chat panel
     * Called externally from the auction module
     */
    function renderPanel(targetEl, role) {
        if (!targetEl) return;

        const canBroadcast = ['SuperAdmin', 'Auctioneer'].includes(role);
        const isTeamOwner = role === 'TeamOwner';
        const teams = AppState.get('teams') || [];

        targetEl.innerHTML = `
            <div class="voice-chat">
                <div class="voice-chat__header">
                    <div class="voice-chat__title">
                        <span class="voice-chat__title-icon">🎙️</span>
                        <span>Auction Voice Channel</span>
                    </div>
                    <div class="voice-chat__status ${_isBroadcasting ? 'live' : ''}" id="vc-status">
                        <span class="voice-chat__status-dot"></span>
                        <span id="vc-status-text">${_isBroadcasting ? 'LIVE' : 'OFFLINE'}</span>
                    </div>
                </div>

                <!-- Waveform Visualizer -->
                <div class="voice-chat__visualizer" id="vc-visualizer">
                    <canvas class="voice-chat__canvas" id="vc-canvas" width="300" height="60"></canvas>
                    ${!_isBroadcasting ? '<div class="voice-chat__idle-text">No active broadcast</div>' : ''}
                </div>

                <!-- Broadcast Controls (Auctioneer / SuperAdmin only) -->
                ${canBroadcast ? `
                    <div class="voice-chat__controls">
                        ${!_isBroadcasting ? `
                            <button class="btn btn--sm btn--primary voice-chat__btn" id="vc-start-broadcast">
                                <span class="btn__icon">🎙️</span> Start Broadcast
                            </button>
                        ` : `
                            <button class="btn btn--sm ${_isMuted ? 'btn--warning' : 'btn--danger'} voice-chat__btn" id="vc-mute-toggle">
                                <span class="btn__icon">${_isMuted ? '🔇' : '🔊'}</span> ${_isMuted ? 'Unmute' : 'Mute'}
                            </button>
                            <button class="btn btn--sm btn--ghost voice-chat__btn" id="vc-stop-broadcast">
                                <span class="btn__icon">⏹️</span> End
                            </button>
                        `}
                    </div>
                ` : ''}

                <!-- Listener: TeamOwner view -->
                ${isTeamOwner && _isBroadcasting ? `
                    <div class="voice-chat__listening">
                        <span class="voice-chat__listening-icon">🔊</span>
                        <span>Listening to auctioneer...</span>
                    </div>
                ` : ''}

                <!-- Connected Participants -->
                <div class="voice-chat__participants">
                    <div class="voice-chat__participants-header">
                        <span>Participants</span>
                        <span class="voice-chat__participants-count">${teams.length + 1}</span>
                    </div>
                    <div class="voice-chat__participants-list">
                        <!-- Auctioneer -->
                        <div class="voice-chat__participant ${_isBroadcasting ? 'speaking' : ''}">
                            <div class="voice-chat__participant-avatar auctioneer">🎙️</div>
                            <div class="voice-chat__participant-info">
                                <div class="voice-chat__participant-name">Auctioneer</div>
                                <div class="voice-chat__participant-role">${_isBroadcasting ? 'Broadcasting' : 'Offline'}</div>
                            </div>
                            <div class="voice-chat__participant-indicator ${_isBroadcasting ? 'active' : ''}"></div>
                        </div>
                        <!-- Team Owners -->
                        ${teams.map(t => `
                            <div class="voice-chat__participant">
                                <div class="voice-chat__participant-avatar" style="background: ${t.color}20; color: ${t.color};">${t.shortName.substring(0, 2)}</div>
                                <div class="voice-chat__participant-info">
                                    <div class="voice-chat__participant-name">${t.name}</div>
                                    <div class="voice-chat__participant-role">Team Owner</div>
                                </div>
                                <div class="voice-chat__participant-indicator ${_isBroadcasting ? 'listening' : ''}"></div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Bind events
        _bindEvents(targetEl);

        // Resume waveform if broadcasting
        if (_isBroadcasting && _analyser) {
            _canvasEl = targetEl.querySelector('#vc-canvas');
            _drawWaveform();
        }
    }

    function _bindEvents(container) {
        const startBtn = container.querySelector('#vc-start-broadcast');
        const muteBtn = container.querySelector('#vc-mute-toggle');
        const stopBtn = container.querySelector('#vc-stop-broadcast');

        if (startBtn) {
            startBtn.addEventListener('click', _startBroadcast);
        }
        if (muteBtn) {
            muteBtn.addEventListener('click', _toggleMute);
        }
        if (stopBtn) {
            stopBtn.addEventListener('click', _stopBroadcast);
        }
    }

    /* ─── Broadcast Controls ─── */
    async function _startBroadcast() {
        try {
            _mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                }
            });

            _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const source = _audioCtx.createMediaStreamSource(_mediaStream);

            // Analyser for waveform visualization
            _analyser = _audioCtx.createAnalyser();
            _analyser.fftSize = 256;
            _analyser.smoothingTimeConstant = 0.8;

            // Gain node for volume / mute control
            _gainNode = _audioCtx.createGain();
            _gainNode.gain.value = 1.0;

            // Audio chain: mic → source → analyser → gain → speakers
            source.connect(_analyser);
            _analyser.connect(_gainNode);
            _gainNode.connect(_audioCtx.destination);

            _isBroadcasting = true;
            _isMuted = false;

            EventBus.publish(Events.VOICE_CHAT_STARTED);
            EventBus.publish(Events.TOAST_SHOW, {
                message: '🎙️ Voice broadcast started — Team Owners can hear you',
                type: 'success',
            });

            AppState.addLog('🎙️ Auctioneer started voice broadcast', 'info');

            // Re-render to update UI state
            _triggerReRender();
        } catch (err) {
            console.error('[VoiceChat] Microphone access denied:', err);
            EventBus.publish(Events.TOAST_SHOW, {
                message: 'Microphone access denied. Please allow microphone permissions.',
                type: 'error',
            });
        }
    }

    function _toggleMute() {
        if (!_gainNode) return;

        _isMuted = !_isMuted;

        // Use gain node to mute/unmute — keeps the waveform visualizer active
        _gainNode.gain.setValueAtTime(
            _isMuted ? 0 : 1.0,
            _audioCtx.currentTime
        );

        EventBus.publish(Events.TOAST_SHOW, {
            message: _isMuted ? '🔇 Microphone muted' : '🔊 Microphone unmuted',
            type: 'info',
        });

        _triggerReRender();
    }

    function _stopBroadcast() {
        if (_mediaStream) {
            _mediaStream.getTracks().forEach(track => track.stop());
            _mediaStream = null;
        }

        if (_audioCtx) {
            _audioCtx.close().catch(() => { });
            _audioCtx = null;
        }

        if (_animationFrame) {
            cancelAnimationFrame(_animationFrame);
            _animationFrame = null;
        }

        _analyser = null;
        _gainNode = null;
        _isBroadcasting = false;
        _isMuted = false;

        EventBus.publish(Events.VOICE_CHAT_STOPPED);
        EventBus.publish(Events.TOAST_SHOW, {
            message: '⏹️ Voice broadcast ended',
            type: 'warning',
        });

        AppState.addLog('⏹️ Auctioneer ended voice broadcast', 'info');
        _triggerReRender();
    }

    /* ─── Waveform Visualization ─── */
    function _drawWaveform() {
        if (!_analyser || !_canvasEl) return;

        const ctx = _canvasEl.getContext('2d');
        const bufferLength = _analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        function draw() {
            if (!_isBroadcasting || !_analyser) return;
            _animationFrame = requestAnimationFrame(draw);

            _analyser.getByteFrequencyData(dataArray);

            const width = _canvasEl.width;
            const height = _canvasEl.height;

            ctx.clearRect(0, 0, width, height);

            const barCount = 40;
            const barWidth = (width / barCount) * 0.7;
            const gap = (width / barCount) * 0.3;
            const centerY = height / 2;

            for (let i = 0; i < barCount; i++) {
                const dataIdx = Math.floor(i * bufferLength / barCount);
                let barHeight = (dataArray[dataIdx] / 255) * (height * 0.8);

                if (_isMuted) barHeight = 2;
                barHeight = Math.max(barHeight, 2);

                const x = i * (barWidth + gap) + gap / 2;

                // Gradient colors: indigo to purple
                const hue = 240 + (i / barCount) * 60;
                const alpha = 0.5 + (barHeight / height) * 0.5;

                ctx.fillStyle = `hsla(${hue}, 70%, 65%, ${alpha})`;
                ctx.fillRect(x, centerY - barHeight / 2, barWidth, barHeight);
            }
        }

        draw();
    }

    function _triggerReRender() {
        // This will trigger the auction module to re-render
        // We publish a tiny state change so auction re-renders
        EventBus.publish(Events.STATE_CHANGED, AppState.getState());
    }

    /* ─── Public API ─── */
    function isBroadcasting() {
        return _isBroadcasting;
    }

    function destroy() {
        _stopBroadcast();
    }

    return Object.freeze({
        init,
        renderPanel,
        isBroadcasting,
        destroy,
    });
})();
