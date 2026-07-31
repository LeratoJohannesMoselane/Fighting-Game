/**
 * Menu system bootstrap — registers all screens on a Router and returns
 * the handle the game loop drives (open/close/menu-key plumbing).
 */

import { Router } from '../router';
import { registerMenuActions, type MenuActions } from '../actions';
import { mainMenuScreen } from './mainMenu';
import { characterSelectScreen } from './characterSelect';
import { rosterScreen } from './roster';
import { moveListScreen } from './moveList';
import { cosmeticsScreen } from './cosmetics';
import { profileScreen } from './profile';
import { optionsScreen } from './options';
import { onlineScreen } from './online';
import { arcadeStatusScreen } from './arcadeStatus';
import { exitScreen } from './exit';

export interface MenuSystem {
  readonly router: Router;
  /** Open (or focus) the main menu. */
  openMain(): void;
  /** Close every menu (used when a match launches). */
  close(): void;
  isOpen(): boolean;
}

export function initMenus(host: HTMLElement, actions: MenuActions): MenuSystem {
  registerMenuActions(actions);

  const router = new Router(host);
  router.register('main', mainMenuScreen);
  router.register('character-select', characterSelectScreen);
  router.register('roster', rosterScreen);
  router.register('movelist', moveListScreen);
  router.register('cosmetics', cosmeticsScreen);
  router.register('profile', profileScreen);
  router.register('options', optionsScreen);
  router.register('online', onlineScreen);
  router.register('arcade-status', arcadeStatusScreen);
  router.register('exit', exitScreen);

  router.onLastClose = () => {
    // ESC at the main menu root: stay on title (menus are the title UI)
    // unless a launch already closed us. Reopen keeps ESC feeling inert.
    if (!router.isOpen()) openMain();
  };

  function openMain(): void {
    router.closeAll();
    router.navigate('main');
  }

  return {
    router,
    openMain,
    close: () => router.closeAll(),
    isOpen: () => router.isOpen(),
  };
}
