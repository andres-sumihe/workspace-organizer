import { useEffect } from 'react';

export type MenuCommandHandler = (commandId: string) => void | Promise<void>;

/**
 * Hook to listen for menu commands from the Electron main process.
 * Menu clicks in Electron will trigger these handlers.
 *
 * Usage:
 * ```tsx
 * useMenuCommands({
 *   'open-workspace-root': () => { ... },
 *   'toggle-sidebar': () => { ... }
 * });
 * ```
 */
export function useMenuCommands(handlers: Record<string, MenuCommandHandler>) {
  useEffect(() => {
    if (!window.api?.onMenuCommand) {
      console.warn('Menu command API not available (not running in Electron)');
      return;
    }

    const unsubscribe = window.api.onMenuCommand(async (payload: { id: string }) => {
      const handler = handlers[payload.id];
      if (handler) {
        try {
          await handler(payload.id);
        } catch (error) {
          console.error(`Error handling menu command "${payload.id}":`, error);
        }
      } else {
        console.warn(`No handler found for menu command: ${payload.id}`);
      }
    });

    return unsubscribe;
  }, [handlers]);
}
