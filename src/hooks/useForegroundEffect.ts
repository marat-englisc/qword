import { useCallback } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";

// Pause subscriptions and polling while a route or the app is out of view.
// Pass a memoized effect, just as with useFocusEffect.
export function useForegroundEffect(
  effect: (refreshKey: number) => void | (() => void),
  refreshKey = 0,
) {
  useFocusEffect(
    useCallback(() => {
      let running = false;
      let cleanup: void | (() => void);

      const update = (foreground: boolean) => {
        if (foreground === running) return;
        running = foreground;
        if (foreground) cleanup = effect(refreshKey);
        else {
          cleanup?.();
          cleanup = undefined;
        }
      };

      update(
        AppState.currentState === "active" || AppState.currentState === null,
      );
      const subscription = AppState.addEventListener("change", (state) =>
        update(state === "active"),
      );
      return () => {
        subscription.remove();
        update(false);
      };
    }, [effect, refreshKey]),
  );
}
