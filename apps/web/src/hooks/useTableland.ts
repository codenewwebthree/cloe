import { useEffect, useState } from 'react';
import { useAccount, useWalletClient } from 'wagmi';
import { TablelandService } from '@cloe/tableland';
import { walletClientToSigner } from '@tableland/sdk';
import type { User } from '@cloe/types';

export function useTableland() {
  const { address, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [tablelandService, setTablelandService] = useState<TablelandService | null>(null);
  const [userTable, setUserTable] = useState<string | null>(null);
  const [profileTable, setProfileTable] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  useEffect(() => {
    async function initTableland() {
      if (!isConnected || !address || !walletClient) {
        setTablelandService(null);
        setUserTable(null);
        setProfileTable(null);
        setUserProfile(null);
        return;
      }

      setIsInitializing(true);
      try {
        const signer = walletClientToSigner(walletClient);
        const service = new TablelandService();
        await service.initialize(signer);
        
        // Initialize both tables
        const { mealsTable, profileTable } = await service.initializeUserTables(address);
        
        setUserTable(mealsTable);
        setProfileTable(profileTable);
        
        // Load user profile
        const profile = await service.getUserProfile(address);
        if (!profile) {
          // Create default profile if none exists
          const defaultProfile: User = {
            id: address,
            name: 'Web3 User',
            email: '',
            dailyCalorieTarget: 2000,
            dailyMacroTargets: {
              carbs: 250,
              fats: 65,
              proteins: 150
            }
          };
          await service.saveUserProfile(defaultProfile);
          setUserProfile(defaultProfile);
        } else {
          setUserProfile(profile);
        }
        
        setTablelandService(service);
      } catch (error) {
        console.error('Failed to initialize Tableland:', error);
      } finally {
        setIsInitializing(false);
      }
    }

    initTableland();
  }, [address, isConnected, walletClient]);

  return {
    tablelandService,
    userTable,
    profileTable,
    userProfile,
    isInitializing,
    isConnected,
    address,
  };
}