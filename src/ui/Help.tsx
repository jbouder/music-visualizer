import { controller } from '../app/controller';
import { setState, useStore } from '../state/store';
import { Sheet } from './Sheet';

export const SHORTCUTS: [string, string][] = [
  ['Space', 'Pause or resume audio'],
  ['N / P', 'Next or previous scene'],
  ['R', 'Random scene'],
  ['T', 'Toggle the Retro look on or off'],
  ['S', 'Star or unstar the current scene'],
  ['F', 'Toggle full screen'],
  ['H', 'Hide or show the deck'],
  ['/', 'Focus scene search'],
  ['?', 'Open this help'],
];

export function Help() {
  const firstRun = !useStore((s) => s.seenHelp);
  const close = () => setState({ panel: 'none', seenHelp: true });

  return (
    <Sheet title={firstRun ? 'Welcome' : 'Help'} onClose={close}>
      <p className="warning" role="note">
        This app shows flashing and fast-moving visuals. If flashing affects you, turn on Reduce flashing in Settings before you start.
      </p>
      {firstRun && (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            controller.playDemo();
            close();
          }}
        >
          Play demo
        </button>
      )}
      <div>
        <h3 className="list-heading">Sources</h3>
        <p className="note">
          Play demo starts a built-in synth loop. Open file plays music from your device (you can also drop files on the page). Microphone
          listens to the room. Capture tab, in desktop Chrome and Edge, visualizes another tab: choose the tab and turn on Share tab audio.
        </p>
        <p className="note">
          Streaming services such as Spotify do not share raw audio with web apps. To visualize them, capture their tab or use the
          microphone.
        </p>
      </div>
      <div>
        <h3 className="list-heading">Keyboard shortcuts</h3>
        <table className="keys">
          <tbody>
            {SHORTCUTS.map(([k, v]) => (
              <tr key={k}>
                <td>
                  <kbd>{k}</kbd>
                </td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Tap or click the visuals to hide or show the player. Drag its title bar to move it, and double-click the title bar to dock it again.
        The minimize button shrinks it to a small box you can drag by its grip.
      </p>
    </Sheet>
  );
}
