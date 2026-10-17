import { SCENES } from '../render/registry';
import type { Game, Skin } from '../state/store';

export type TerminalAction =
  | { type: 'intro' }
  | { type: 'stats' }
  | { type: 'skin'; skin: Skin }
  | { type: 'game'; game: Game }
  | { type: 'clear' }
  | { type: 'exit' };

export interface CommandResult {
  lines: string[];
  action?: TerminalAction;
}

export const BOOT_LINES = [
  'MV-OS 2.0  (c) 1999',
  'ESTABLISHING SECURE LINK ............ OK',
  'VERIFYING ACCESS KEY ................ OK',
  '',
  'ACCESS GRANTED.',
  "TYPE 'HELP' FOR COMMANDS.",
];

const SKINS: Skin[] = ['classic', 'midnight', 'metal', 'hifi', 'neon', 'toxic', 'win31', 'glass'];

const HELP = [
  'DEMO               RUN THE INTRO',
  'STATS              TOGGLE THE SYSTEM MONITOR',
  'SKIN <NAME>        CHANGE THE PLAYER SKIN',
  'SNAKE              PLAY SNAKE',
  'BREAKOUT           PLAY BREAKOUT',
  'SCENES             LIST SCENES',
  'CLEAR              CLEAR THE SCREEN',
  'EXIT               LOG OUT',
];

export function runCommand(input: string): CommandResult {
  const [cmd = '', ...args] = input.trim().toLowerCase().split(/\s+/);
  switch (cmd) {
    case '':
      return { lines: [] };
    case 'help':
    case '?':
      return { lines: HELP };
    case 'demo':
    case 'intro':
      return { lines: ['LOADING INTRO ...'], action: { type: 'intro' } };
    case 'stats':
    case 'monitor':
      return { lines: ['SYSTEM MONITOR TOGGLED.'], action: { type: 'stats' } };
    case 'skin': {
      const skin = args[0] as Skin | undefined;
      if (!skin || !SKINS.includes(skin)) return { lines: [`USAGE: SKIN <NAME>`, `  ${SKINS.join('  ').toUpperCase()}`] };
      return { lines: [`SKIN SET TO ${skin.toUpperCase()}.`], action: { type: 'skin', skin } };
    }
    case 'snake':
    case 'breakout':
      return { lines: [`STARTING ${cmd.toUpperCase()} ...`], action: { type: 'game', game: cmd } };
    case 'scenes':
    case 'ls':
      return { lines: SCENES.filter((s) => !s.hidden).map((s) => `${s.id.padEnd(12)} ${s.name.toUpperCase()}`) };
    case 'clear':
    case 'cls':
      return { lines: [], action: { type: 'clear' } };
    case 'exit':
    case 'logout':
    case 'quit':
      return { lines: ['GOODBYE.'], action: { type: 'exit' } };
    default:
      return { lines: [`${cmd.toUpperCase()}: COMMAND NOT FOUND`] };
  }
}
