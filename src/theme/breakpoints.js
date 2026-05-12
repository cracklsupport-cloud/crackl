/**
 * CRACKL — Shared Responsive Breakpoints
 * Single source of truth for all screen-size logic.
 */
import { useWindowDimensions } from 'react-native';

// Breakpoint thresholds (px)
export const BP = {
  phone:   480,   // phone portrait
  tablet:  768,   // tablet / small laptop — nav collapses
  desktop: 1024,  // standard desktop — 2-col layouts
  wide:    1150,  // wide desktop — 3-col (right sidebar visible)
};

/**
 * useResponsive() — call once per screen component.
 * Returns booleans + the raw width so screens can still do custom checks.
 */
export function useResponsive() {
  const { width } = useWindowDimensions();
  return {
    width,
    isPhone:   width < BP.phone,    // < 480
    isMobile:  width < BP.tablet,   // < 768  (nav stacks, single-col)
    isDesktop: width >= BP.desktop,  // >= 1024
    isWide:    width >= BP.wide,     // >= 1150 (show 3rd column)
  };
}
