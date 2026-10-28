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
      // Use Topbar.Button as primary (most stable across themes and Spotify versions)
      if (Spicetify.Topbar && Spicetify.Topbar.Button) {
        this.button = new Spicetify.Topbar.Button(
          'Listen Together',
          iconSvg,
          () => this.openMenuModal(),
          false,
          false
        );
      } else if (Spicetify.Playbar && (Spicetify.Playbar as any).Button) {
        this.button = new (Spicetify.Playbar as any).Button(
          'Listen Together',
          iconSvg,
          () => this.openMenuModal()
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

  private openMenuModal(): void {
    try {
      if (this.currentRoomId) {
        const promptText = `Active Session: ${this.currentRoomId} (${this.isHost ? 'Host' : 'Listener'})\n\nLeave session?`;
        if (confirm(promptText)) {
          this.actions.onLeave();
        }
      } else {
        const choice = prompt('Listen Together:\n1. Enter a 6-letter Room ID to join\n2. Leave blank to Host a new party', '');
        if (choice === null) return;

        const trimmed = choice.trim().toUpperCase();
        if (trimmed.length === 0) {
          this.actions.onStartHost();
        } else if (trimmed.length === 6) {
          this.actions.onJoin(trimmed);
        } else {
          Spicetify.showNotification('Invalid Room ID. Must be 6 characters.', true);
        }
      }
    } catch (err) {
      console.error('[ListenTogether] Menu modal error:', err);
    }
  }
}
