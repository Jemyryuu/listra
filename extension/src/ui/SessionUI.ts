export interface SessionUIActions {
  onStartHost: () => void;
  onJoin: (roomId: string) => void;
  onLeave: () => void;
}

export class SessionUI {
  private button: Spicetify.Playbar.Button | null = null;
  private actions: SessionUIActions;
  private currentRoomId: string | null = null;
  private isHost = false;

  constructor(actions: SessionUIActions) {
    this.actions = actions;
  }

  public register(): void {
    // Headphones icon SVG
    const iconSvg = `
      <svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.5a6.5 6.5 0 0 0-6.5 6.5v4.5A2.5 2.5 0 0 0 4 15h1a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H2.5V8a5.5 5.5 0 1 1 11 0v1H12a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1a2.5 2.5 0 0 0 2.5-2.5V8A6.5 6.5 0 0 0 8 1.5z"/>
      </svg>
    `;

    this.button = new Spicetify.Playbar.Button(
      'Listen Together',
      iconSvg,
      () => {
        this.openMenuModal();
      }
    );

    this.button.register();
  }

  public setSessionActive(roomId: string, isHost: boolean): void {
    this.currentRoomId = roomId;
    this.isHost = isHost;
    if (this.button) {
      this.button.active = true;
      this.button.element.style.color = '#1db954'; // Spotify green
    }
    Spicetify.showNotification(`[Listen Together] ${isHost ? 'Hosting' : 'Joined'} Room: ${roomId}`);
  }

  public setSessionInactive(): void {
    this.currentRoomId = null;
    this.isHost = false;
    if (this.button) {
      this.button.active = false;
      this.button.element.style.color = '';
    }
    Spicetify.showNotification('[Listen Together] Left session.');
  }

  private openMenuModal(): void {
    if (this.currentRoomId) {
      // In active session
      const promptText = `Active Session: ${this.currentRoomId} (${this.isHost ? 'Host' : 'Listener'})\n\nLeave session?`;
      if (confirm(promptText)) {
        this.actions.onLeave();
      }
    } else {
      // Not in session
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
  }
}
