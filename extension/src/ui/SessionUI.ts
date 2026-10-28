export interface SessionUIActions {
  onStartHost: () => void;
  onJoin: (roomId: string) => void;
  onLeave: () => void;
  isDaemonConnected: () => boolean;
  onLaunchDaemon?: () => void;
}

export class SessionUI {
  private button: any = null;
  private actions: SessionUIActions;
  private currentRoomId: string | null = null;
  private isHost = false;
  private isLaunchingDaemon = false;

  constructor(actions: SessionUIActions) {
    this.actions = actions;
  }

  public register(): void {
    const iconSvg = `
      <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.5a6.5 6.5 0 0 0-6.5 6.5v4.5A2.5 2.5 0 0 0 4 15h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H2.5V8a5.5 5.5 0 1 1 11 0v1H12a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a2.5 2.5 0 0 0 2.5-2.5V8A6.5 6.5 0 0 0 8 1.5z"/>
      </svg>
    `;

    try {
      if (Spicetify.Topbar && Spicetify.Topbar.Button) {
        this.button = new Spicetify.Topbar.Button(
          'Listra',
          iconSvg,
          () => this.openModal(),
          false,
          false
        );
      } else if (Spicetify.Playbar && (Spicetify.Playbar as any).Button) {
        this.button = new (Spicetify.Playbar as any).Button(
          'Listra',
          iconSvg,
          () => this.openModal()
        );
      }
    } catch (err) {
      console.warn('[Listra] Error creating UI button:', err);
    }
  }

  public setDaemonLaunching(isLaunching: boolean): void {
    this.isLaunchingDaemon = isLaunching;
    if (document.getElementById('lt-modal-container')) {
      this.openModal();
    }
  }

  public updateDaemonStatus(connected: boolean): void {
    if (document.getElementById('lt-modal-container')) {
      this.openModal();
    }
  }

  public setSessionActive(roomId: string, isHost: boolean): void {
    this.currentRoomId = roomId;
    this.isHost = isHost;
    this.isLaunchingDaemon = false;
    try {
      if (this.button) {
        this.button.active = true;
        if (this.button.element) {
          this.button.element.style.color = '#1db954';
        }
      }
      Spicetify.showNotification(`[Listra] ${isHost ? 'Hosting' : 'Joined'} Room: ${roomId}`);
    } catch (e) {}

    if (document.getElementById('lt-modal-container')) {
      this.openModal();
    }
  }

  public setSessionInactive(): void {
    this.currentRoomId = null;
    this.isHost = false;
    this.isLaunchingDaemon = false;
    try {
      if (this.button) {
        this.button.active = false;
        if (this.button.element) {
          this.button.element.style.color = '';
        }
      }
      Spicetify.showNotification('[Listra] Left session.');
    } catch (e) {}

    if (document.getElementById('lt-modal-container')) {
      this.openModal();
    }
  }

  public openModal(): void {
    if (!Spicetify.PopupModal) {
      if (this.currentRoomId) {
        if (confirm(`Active Session: ${this.currentRoomId}\nLeave session?`)) {
          this.actions.onLeave();
        }
      } else {
        const code = prompt('Enter 6-letter Room ID (or leave blank to Host):', '');
        if (code === null) return;
        const trimmed = code.trim().toUpperCase();
        if (trimmed.length === 0) {
          this.actions.onStartHost();
        } else if (trimmed.length === 6) {
          this.actions.onJoin(trimmed);
        }
      }
      return;
    }

    const container = document.createElement('div');
    container.id = 'lt-modal-container';
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
      color: #fff;
      font-family: var(--font-family, sans-serif);
      padding: 8px 4px;
    `;

    const styleEl = document.createElement('style');
    styleEl.textContent = `
      #lt-modal-container button {
        cursor: pointer;
        user-select: none;
        transition: transform 0.08s ease, filter 0.15s ease, background-color 0.2s ease;
      }
      #lt-modal-container button:hover:not(:disabled) {
        filter: brightness(1.1);
      }
      #lt-modal-container button:active:not(:disabled) {
        transform: scale(0.97) !important;
        filter: brightness(0.95);
      }
      #lt-join-input::placeholder {
        color: #777777;
        font-weight: 500;
        letter-spacing: 1px;
        font-size: 14px;
        text-transform: none;
      }
    `;
    container.appendChild(styleEl);

    if (this.currentRoomId) {
      const daemonConnected = this.actions.isDaemonConnected();
      const hostStatusText = daemonConnected
        ? '<span style="color: #1db954;">●</span> <b>Discord RPC is active.</b> Friends can click <i>"Listra"</i> on your Discord profile to join automatically.'
        : `
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: #ffa42b; background: rgba(255, 164, 43, 0.1); border: 1px solid rgba(255, 164, 43, 0.25); padding: 8px 12px; border-radius: 6px; line-height: 1.4;">
          <div><span style="color: #e91429;">●</span> <b>Companion daemon offline.</b> Discord RPC is not broadcasting.</div>
          <button id="lt-reconnect-daemon-btn" style="background: #3e3e3e; border: none; color: #fff; padding: 6px 10px; border-radius: 12px; font-weight: 600; font-size: 11px; cursor: pointer;">
            Launch Daemon
          </button>
        </div>
        `;

      const sessionContent = document.createElement('div');
      sessionContent.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';
      sessionContent.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; background: #282828; padding: 12px 16px; border-radius: 8px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${this.isHost ? '#1db954' : '#3d91f4'}; font-weight: bold;">
              ● ${this.isHost ? 'Hosting Party' : 'Listening In Sync'}
            </div>
            <div style="font-size: 24px; font-weight: 800; letter-spacing: 3px; font-family: monospace; margin-top: 4px;">
              ${this.currentRoomId}
            </div>
          </div>
          <button id="lt-copy-btn" style="background: #3e3e3e; border: none; color: #fff; padding: 8px 14px; border-radius: 20px; font-weight: 600; font-size: 13px; cursor: pointer;">
            Copy Code
          </button>
        </div>

        <div style="font-size: 13px; color: #b3b3b3; line-height: 1.5;">
          ${
            this.isHost
              ? hostStatusText
              : 'You are synchronized to the host. Any track changes or pauses will sync automatically.'
          }
        </div>

        <div style="display: flex; gap: 10px; margin-top: 8px;">
          <button id="lt-copy-link-btn" style="flex: 1; background: #282828; border: 1px solid #3e3e3e; color: #fff; padding: 12px; border-radius: 24px; font-weight: 600; font-size: 14px; cursor: pointer;">
            Copy Join Link
          </button>
          <button id="lt-leave-btn" style="flex: 1; background: #e91429; border: none; color: #fff; padding: 12px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer;">
            Leave Party
          </button>
        </div>
      `;
      container.appendChild(sessionContent);

      const reconnectBtn = container.querySelector('#lt-reconnect-daemon-btn') as HTMLButtonElement | null;
      if (reconnectBtn) {
        reconnectBtn.onclick = (e) => {
          e.stopPropagation();
          reconnectBtn.innerText = 'Launching...';
          reconnectBtn.disabled = true;
          this.actions.onLaunchDaemon?.();
        };
      }

      const copyBtn = container.querySelector('#lt-copy-btn') as HTMLButtonElement;
      if (copyBtn) {
        copyBtn.onclick = (e) => {
          e.stopPropagation();
          if (this.currentRoomId) {
            navigator.clipboard.writeText(this.currentRoomId);
            copyBtn.innerText = 'Copied!';
            setTimeout(() => (copyBtn.innerText = 'Copy Code'), 2000);
          }
        };
      }

      const copyLinkBtn = container.querySelector('#lt-copy-link-btn') as HTMLButtonElement;
      if (copyLinkBtn) {
        copyLinkBtn.onclick = (e) => {
          e.stopPropagation();
          if (this.currentRoomId) {
            const link = `https://listra.pages.dev/join?room=${this.currentRoomId}`;
            navigator.clipboard.writeText(link);
            copyLinkBtn.innerText = 'Link Copied!';
            setTimeout(() => (copyLinkBtn.innerText = 'Copy Join Link'), 2000);
          }
        };
      }

      const leaveBtn = container.querySelector('#lt-leave-btn') as HTMLButtonElement;
      if (leaveBtn) {
        leaveBtn.onclick = (e) => {
          e.stopPropagation();
          Spicetify.PopupModal.hide();
          this.actions.onLeave();
        };
      }
    } else {
      const daemonConnected = this.actions.isDaemonConnected();

      let hostSection = '';
      if (daemonConnected) {
        hostSection = `
          <div style="background: #242424; padding: 16px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div style="font-weight: 700; font-size: 15px;">Host a Party</div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #1db954;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #1db954;"></span>
                Daemon active
              </div>
            </div>
            <div style="font-size: 12px; color: #a7a7a7; margin-bottom: 12px;">
              Creates a room code and sets your Discord status with a clickable join button.
            </div>
            <button id="lt-host-btn" style="width: 100%; background: #1db954; color: #000; border: none; padding: 12px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer;">
              Start Hosting Party
            </button>
          </div>
        `;
      } else if (this.isLaunchingDaemon) {
        hostSection = `
          <div style="background: #242424; padding: 16px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div style="font-weight: 700; font-size: 15px;">Host a Party</div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #ffa42b;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ffa42b;"></span>
                Starting daemon...
              </div>
            </div>
            <div style="font-size: 12px; color: #a7a7a7; margin-bottom: 12px;">
              Launching background companion daemon to connect Discord Rich Presence...
            </div>
            <button id="lt-host-btn" disabled style="width: 100%; background: #333333; color: #1db954; border: 1px solid #1db954; padding: 12px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: wait;">
              Starting Daemon & Hosting...
            </button>
          </div>
        `;
      } else {
        hostSection = `
          <div style="background: #242424; padding: 16px; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div style="font-weight: 700; font-size: 15px;">Host a Party</div>
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #888;">
                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #888;"></span>
                Daemon standby
              </div>
            </div>
            <div style="font-size: 12px; color: #a7a7a7; margin-bottom: 12px;">
              Creates a room code and sets your Discord status with a clickable join button.
            </div>
            <button id="lt-host-btn" style="width: 100%; background: #1db954; color: #000; border: none; padding: 12px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer;">
              Start Hosting Party
            </button>
          </div>
        `;
      }

      const mainContent = document.createElement('div');
      mainContent.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';
      mainContent.innerHTML = `
        <div style="color: #b3b3b3; font-size: 14px; line-height: 1.5;">
          Spicetify extension to synchronize Spotify playback in real time with friends via WebRTC and Discord Rich Presence.
        </div>

        ${hostSection}

        <div style="display: flex; align-items: center; text-align: center; color: #535353; font-size: 12px; font-weight: bold; margin: 4px 0;">
          <div style="flex: 1; height: 1px; background: #333;"></div>
          <span style="padding: 0 10px;">OR JOIN A FRIEND</span>
          <div style="flex: 1; height: 1px; background: #333;"></div>
        </div>

        <div style="background: #242424; padding: 16px; border-radius: 8px;">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 8px;">Enter 6-Letter Room Code</div>
          <div style="display: flex; gap: 8px;">
            <input id="lt-join-input" type="text" maxlength="6" placeholder="e.g. ABC123" autocomplete="off" spellcheck="false" style="flex: 1; background: #121212; border: 1px solid #3e3e3e; color: #fff; padding: 10px 14px; border-radius: 8px; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; text-align: center; outline: none; transition: border-color 0.2s;" />
            <button id="lt-join-btn" style="background: #fff; color: #000; border: none; padding: 0 20px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer;">
              Join
            </button>
          </div>
        </div>
      `;
      container.appendChild(mainContent);

      const hostBtn = container.querySelector('#lt-host-btn') as HTMLButtonElement | null;
      if (hostBtn && !hostBtn.disabled) {
        hostBtn.onclick = (e) => {
          e.stopPropagation();
          hostBtn.disabled = true;
          hostBtn.innerText = 'Starting Party...';
          this.actions.onStartHost();
        };
      }

      const joinInput = container.querySelector('#lt-join-input') as HTMLInputElement;
      const joinBtn = container.querySelector('#lt-join-btn') as HTMLButtonElement;

      // Prevent Spotify shortcuts (space, media keys, navigation) from intercepting room code input
      ['keydown', 'keypress', 'keyup'].forEach((evt) => {
        joinInput.addEventListener(evt, (e) => {
          e.stopPropagation();
        });
      });

      joinInput.addEventListener('input', () => {
        joinInput.value = joinInput.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        joinInput.style.borderColor = '#3e3e3e';
      });

      joinInput.addEventListener('focus', () => {
        if (joinInput.style.borderColor !== 'rgb(233, 20, 41)') {
          joinInput.style.borderColor = '#1db954';
        }
      });

      joinInput.addEventListener('blur', () => {
        if (joinInput.style.borderColor !== 'rgb(233, 20, 41)') {
          joinInput.style.borderColor = '#3e3e3e';
        }
      });

      const triggerJoin = () => {
        const val = joinInput.value.trim().toUpperCase();
        if (val.length === 6) {
          joinBtn.disabled = true;
          joinBtn.innerText = 'Joining...';
          this.actions.onJoin(val);
        } else {
          joinInput.style.borderColor = '#e91429';
          joinInput.focus();
          Spicetify.showNotification('Please enter a valid 6-letter room code.', true);
        }
      };

      joinBtn.onclick = (e) => {
        e.stopPropagation();
        triggerJoin();
      };

      joinInput.onkeydown = (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') triggerJoin();
      };
    }

    Spicetify.PopupModal.display({
      title: 'Listra',
      content: container,
      isLarge: false,
    });
  }
}
