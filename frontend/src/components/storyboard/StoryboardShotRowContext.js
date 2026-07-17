import { createContext, useContext } from 'react';

export const StoryboardShotRowContext = createContext(null);

export function useStoryboardShotRowActions() {
  return useContext(StoryboardShotRowContext);
}

