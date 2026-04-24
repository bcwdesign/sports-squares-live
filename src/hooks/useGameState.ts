import { useEffect, useState } from "react";
import { loadState, saveState, type GameState } from "@/lib/gameState";

export function useGameState(): [GameState, (updater: (s: GameState) => GameState) => void] {
  const [state, setState] = useState<GameState>(() => loadState());

  useEffect(() => {
    const sync = () => setState(loadState());
    window.addEventListener("squares:update", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("squares:update", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = (updater: (s: GameState) => GameState) => {
    const next = updater(loadState());
    saveState(next);
    setState(next);
  };

  return [state, update];
}
