export interface SessionUIActions {
  onStartHost: () => void;
  onJoin: (roomId: string) => void;
  onLeave: () => void;
}

export class SessionUI {
  private button: any = null;
  private actions: SessionUIActions;
  private currentRoomId: string | null = null;
  private isHost = false;

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
          'Listen Together',
          iconSvg,
          () => this.openModal(),
          false,
          false
        );
      } else if (Spicetify.Playbar && (Spicetify.Playbar as any).Button) {
        this.button = new (Spicetify.Playbar as any).Button(
          'Listen Together',
          iconSvg,
          () => this.openModal()
        );
      }
    } catch (err) {
      console.warn('[ListenTogether] Error creating UI button:', err);
    }
  }

  public setSessionActive(roomId: string, isHost: boolean): void {
    this.currentRoomId = roomId;
    this.isHost = isHost;
    try {
      if (this.button) {
        this.button.active = true;
        if (this.button.element) {
          this.button.element.style.color = '#1db954';
        }
      }
      Spicetify.showNotification(`[Listen Together] ${isHost ? 'Hosting' : 'Joined'} Room: ${roomId}`);
    } catch (e) {}
  }

  public setSessionInactive(): void {
    this.currentRoomId = null;
    this.isHost = false;
    try {
      if (this.button) {
        this.button.active = false;
        if (this.button.element) {
          this.button.element.style.color = '';
        }
      }
      Spicetify.showNotification('[Listen Together] Left session.');
    } catch (e) {}
  }

  public openModal(): void {
    if (!Spicetify.PopupModal) {
      // Fallback
      if (this.currentRoomId) {
        if (confirm(`Active Session: ${this.currentRoomId}\nLeave session?`)) {
          this.actions.onLeave();
        }
      } else {
        const code = prompt('Enter 6-letter Room ID (or leave blank to Host):', '');
        if (code === null) return;
        const trimmed = code.trim().toUpperCase();
        if (trimmed.length === 0) this.actions.onStartHost();
        else if (trimmed.length === 6) this.actions.onJoin(trimmed);
      }
      return;
    }

    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
      color: #fff;
      font-family: var(--font-family, sans-serif);
      padding: 8px 4px;
    `;

    if (this.currentRoomId) {
      // --- Active Session View ---
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; background: #282828; padding: 12px 16px; border-radius: 8px;">
          <div>
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: ${this.isHost ? '#1db954' : '#3d91f4'}; font-weight: bold;">
              ● ${this.isHost ? 'Hosting Party' : 'Listening In Sync'}
            </div>
            <div style="font-size: 24px; font-weight: 800; letter-spacing: 3px; font-family: monospace; margin-top: 4px;">
              ${this.currentRoomId}
            </div>
          </div>
          <button id="lt-copy-btn" style="background: #3e3e3e; border: none; color: #fff; padding: 8px 14px; border-radius: 20px; font-weight: 600; font-size: 13px; cursor: pointer; transition: 0.2s;">
            Copy Code
          </button>
        </div>

        <div style="font-size: 13px; color: #b3b3b3; line-height: 1.5;">
          ${
            this.isHost
              ? '<b>Discord RPC is active.</b> Friends can click <i>"Listen Together"</i> on your Discord profile to join automatically.'
              : 'You are synchronized to the host. Any track changes or pauses will sync automatically.'
          }
        </div>

        <div style="display: flex; gap: 10px; margin-top: 8px;">
          <button id="lt-copy-link-btn" style="flex: 1; background: #282828; border: 1px solid #3e3e3e; color: #fff; padding: 12px; border-radius: 24px; font-weight: 600; font-size: 14px; cursor: pointer; transition: 0.2s;">
            Copy Join Link
          </button>
          <button id="lt-leave-btn" style="flex: 1; background: #e91429; border: none; color: #fff; padding: 12px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer; transition: 0.2s;">
            Leave Party
          </button>
        </div>
      `;

      // Event handlers
      const copyBtn = container.querySelector('#lt-copy-btn') as HTMLButtonElement;
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(this.currentRoomId!);
        copyBtn.innerText = 'Copied!';
        setTimeout(() => (copyBtn.innerText = 'Copy Code'), 2000);
      };

      const copyLinkBtn = container.querySelector('#lt-copy-link-btn') as HTMLButtonElement;
      copyLinkBtn.onclick = () => {
        const link = `https://listen-together.pages.dev/join?room=${this.currentRoomId}`;
        navigator.clipboard.writeText(link);
        copyLinkBtn.innerText = 'Link Copied!';
        setTimeout(() => (copyLinkBtn.innerText = 'Copy Join Link'), 2000);
      };

      const leaveBtn = container.querySelector('#lt-leave-btn') as HTMLButtonElement;
      leaveBtn.onclick = () => {
        Spicetify.PopupModal.hide();
        this.actions.onLeave();
      };
    } else {
      // --- Idle / Join / Host View ---
      container.innerHTML = `
        <div style="color: #b3b3b3; font-size: 14px; line-height: 1.5;">
          Synchronize Spotify playback in real time with friends via WebRTC and Discord Rich Presence.
        </div>

        <!-- Host Option -->
        <div style="background: #242424; padding: 16px; border-radius: 8px;">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 4px;">Host a Party</div>
          <div style="font-size: 12px; color: #a7a7a7; margin-bottom: 12px;">
            Creates a room code and sets your Discord status with a clickable join button.
          </div>
          <button id="lt-host-btn" style="width: 100%; background: #1db954; color: #000; border: none; padding: 12px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer; transition: transform 0.1s, background 0.2s;">
            Start Hosting Party
          </button>
        </div>

        <div style="display: flex; align-items: center; text-align: center; color: #535353; font-size: 12px; font-weight: bold; margin: 4px 0;">
          <div style="flex: 1; height: 1px; background: #333;"></div>
          <span style="padding: 0 10px;">OR JOIN A FRIEND</span>
          <div style="flex: 1; height: 1px; background: #333;"></div>
        </div>

        <!-- Join Option -->
        <div style="background: #242424; padding: 16px; border-radius: 8px;">
          <div style="font-weight: 700; font-size: 15px; margin-bottom: 8px;">Enter 6-Letter Room Code</div>
          <div style="display: flex; gap: 8px;">
            <input id="lt-join-input" type="text" maxlength="6" placeholder="ABC123" style="flex: 1; background: #121212; border: 1px solid #3e3e3e; color: #fff; padding: 10px 14px; border-radius: 8px; font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; text-align: center; outline: none;" />
            <button id="lt-join-btn" style="background: #fff; color: #000; border: none; padding: 0 20px; border-radius: 24px; font-weight: 700; font-size: 14px; cursor: pointer;">
              Join
            </button>
          </div>
        </div>
      `;

      const hostBtn = container.querySelector('#lt-host-btn') as HTMLButtonElement;
      hostBtn.onclick = () => {
        Spicetify.PopupModal.hide();
        this.actions.onStartHost();
      };

      const joinInput = container.querySelector('#lt-join-input') as HTMLInputElement;
      const joinBtn = container.querySelector('#lt-join-btn') as HTMLButtonElement;

      const triggerJoin = () => {
        const val = joinInput.value.trim().toUpperCase();
        if (val.length === 6) {
          Spicetify.PopupModal.hide();
          this.actions.onJoin(val);
        } else {
          joinInput.style.borderColor = '#e91429';
          Spicetify.showNotification('Room code must be exactly 6 characters.', true);
        }
      };

      joinBtn.onclick = triggerJoin;
      joinInput.onkeydown = (e) => {
        if (e.key === 'Enter') triggerJoin();
      };
    }

    Spicetify.PopupModal.display({
      title: 'Listen Together',
      content: container,
      isLarge: false,
    });
  }
}
