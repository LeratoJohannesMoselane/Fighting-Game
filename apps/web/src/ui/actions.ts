/**
 * Bridge between the menu system and the game loop (main.ts) without
 * circular imports: main registers handlers at boot; screens call them.
 */

import type { ArcadeStage, MatchConfig } from '../roster';

export interface MenuActions {
  /** Launch a configured match (versus / cpu / arcade / training). */
  launch: (cfg: MatchConfig) => void;
  /** Continue an arcade run to the next stage. */
  launchArcadeStage: (p1Id: string, stageIndex: number) => void;
  /** Called when menus fully close without launching (stay on title). */
  idle: () => void;
}

let actions: MenuActions | null = null;

export function registerMenuActions(a: MenuActions): void {
  actions = a;
}

export function menuActions(): MenuActions {
  if (!actions) throw new Error('Menu actions not registered yet');
  return actions;
}

/** Convenience: does this screen flow need a next arcade stage? */
export function arcadeNext(p1Id: string, stage: ArcadeStage, stageIndex: number): void {
  void stage;
  menuActions().launchArcadeStage(p1Id, stageIndex);
}
