import { useEffect, useState } from "react";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

/**
 * Hook to monitor network connectivity status.
 * Returns true when online, false when offline.
 */
export function useNetworkStatus(): boolean {
  const [isConnected, setIsConnected] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const connected =
        state.isConnected !== false && state.isInternetReachable !== false;
      setIsConnected(connected ?? true);
    });

    // Initial check
    NetInfo.fetch().then((state) => {
      const connected =
        state.isConnected !== false && state.isInternetReachable !== false;
      setIsConnected(connected ?? true);
    });

    return () => unsubscribe();
  }, []);

  return isConnected;
}
