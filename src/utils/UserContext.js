/**
 * CRACKL — Global User Context
 * 
 * Provides instant, app-wide user state synchronization.
 * When profile pic or username changes on the Profile page,
 * the Dashboard, HomeShell header, and every other screen
 * immediately reflect the update — zero lag, zero refetch.
 * 
 * Uses React Context + optimistic updates + AsyncStorage persistence.
 */
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { saveSessionUser } from './authSession';

const UserContext = createContext(null);

export function UserProvider({ children, initialUser, onUserChange }) {
  const [user, setUser] = useState(initialUser);
  // Keep a ref for latest user to avoid stale closures
  const userRef = useRef(user);
  userRef.current = user;

  // Re-sync when initialUser changes from outside (e.g., game updates coins/xp)
  useEffect(() => {
    if (initialUser && initialUser !== userRef.current) {
      // Only update fields that changed externally, preserve local optimistic changes
      const merged = { ...userRef.current, ...initialUser };
      setUser(merged);
      userRef.current = merged;
    }
  }, [initialUser]);

  // Sync user state everywhere — no navigation, no delay
  const syncUser = useCallback(async (updatedUser) => {
    if (!updatedUser) return;
    // Merge with existing user data to preserve fields not returned by API
    const merged = { ...userRef.current, ...updatedUser };
    setUser(merged);
    userRef.current = merged;
    // Persist the active tab session without clobbering other web tabs.
    saveSessionUser(merged).catch(() => {});
    // Notify parent (AppNavigator) so its own state stays in sync
    if (onUserChange) onUserChange(merged);
  }, [onUserChange]);

  // Optimistic update — instantly apply changes before API call resolves
  const optimisticUpdate = useCallback((partialUpdate) => {
    const optimistic = { ...userRef.current, ...partialUpdate };
    setUser(optimistic);
    userRef.current = optimistic;
    saveSessionUser(optimistic).catch(() => {});
    if (onUserChange) onUserChange(optimistic);
  }, [onUserChange]);

  return (
    <UserContext.Provider value={{ user, syncUser, optimisticUpdate }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  // Return null gracefully for screens rendered outside UserProvider (e.g., GameScreen)
  return ctx;
}

export default UserContext;
