'use client';
/* eslint-disable @typescript-eslint/no-unused-vars */
import { WalletClientSigner } from '@aa-sdk/core';
import { alchemy, AlchemySmartAccountClient, sepolia } from '@account-kit/infra';
import {
  IPluginAbi,
  SessionKeyAccessListType,
  SessionKeyPermissionsBuilder,
  SessionKeyPlugin,
  SessionKeySigner,
  createModularAccountAlchemyClient,
  sessionKeyPluginActions,
} from '@account-kit/smart-contracts';
import { useEffect, useState } from 'react';
import { createWalletClient, custom, encodeFunctionData, zeroHash } from 'viem';
import styles from './page.module.css';
import {
  abi as registryAbi,
  address as registryAddress,
} from './RegistryContract';
import { writeContract } from 'viem/actions';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY as string;
const chain = sepolia;

export default function Home() {
  const [client, setClient] = useState<AlchemySmartAccountClient | undefined>();
  const [sessionKeyClient, setSessionKeyClient] = useState<any>();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [sessionKeySigner, setSessionKeySigner] = useState<SessionKeySigner>();
  const [countValue, setCountValue] = useState<number>();
  const transport = alchemy({ apiKey: API_KEY });

  const walletClient = createWalletClient({
    chain: sepolia,
    transport: custom((window as any).ethereum),
  });

  const signer = new WalletClientSigner(walletClient, 'wallet');

  useEffect(() => {
    // check connection status on page load
    (async () => {
      const accounts = await walletClient.request({
        method: 'eth_accounts',
      });

      if (accounts.length > 0) {
        setIsConnected(true);
        await initializeClient();
      }
    })();
  }, []);

  const connectWallet = async () => {
    try {
      const accounts = await walletClient.request({
        method: 'eth_requestAccounts',
      });
      if (accounts.length > 0) {
        setIsConnected(true);
        await initializeClient();
        console.log('Connected account:', accounts[0]);
      } else {
        console.log('No accounts found.');
      }
    } catch (error) {
      console.error('Error connecting to wallet:', error);
    }
  };

  const initializeClient = async () => {
    const sessionKeySigner = new SessionKeySigner();
    setSessionKeySigner(sessionKeySigner);

    const client: any = (
      await createModularAccountAlchemyClient({
        chain,
        transport,
        signer,
      })
    ).extend(sessionKeyPluginActions);
    setClient(client);

    const isPluginInstalled = await client
      .getInstalledPlugins({})
      .then((x: any) => {
        console.log(x);
        return x.includes(SessionKeyPlugin.meta.addresses[chain.id])
      });


    const sessionKeyAddress = await sessionKeySigner.getAddress();
    console.log("isPluginInstalled", isPluginInstalled);

    if (!isPluginInstalled) {
      const initialPermissions = new SessionKeyPermissionsBuilder()
        .setNativeTokenSpendLimit({ spendLimit: 1n })
        .setContractAccessControlType(SessionKeyAccessListType.ALLOW_ALL_ACCESS)
        .setTimeRange({
          validFrom: Math.round(Date.now() / 1000),
          validUntil: Math.round(Date.now() / 1000 + 60 * 60),
        });

      const { hash } = await client.installSessionKeyPlugin({
        args: [[sessionKeyAddress], [zeroHash], [initialPermissions.encode()]],
      });

      await client.waitForUserOperationTransaction({ hash });
    } else {
      const result = await client.updateSessionKeyPermissions({
        key: sessionKeyAddress,
        permissions: new SessionKeyPermissionsBuilder()
          .setNativeTokenSpendLimit({ spendLimit: 1n })
          .setContractAccessControlType(SessionKeyAccessListType.ALLOW_ALL_ACCESS)
          .setTimeRange({
            validFrom: Math.round(Date.now() / 1000),
            // valid for 1 hour
            validUntil: Math.round(Date.now() / 1000 + 60 * 60),
          })
          .encode(),
      });
      // const result = await client.removeSessionKey({
      //   key: sessionKeyAddress,
      // });
      console.log("update result", result);
    }

    const sessionKeyClient = (
      await createModularAccountAlchemyClient({
        chain,
        signer: sessionKeySigner,
        transport,
        accountAddress: client.getAddress({ account: client.account! }),
      })
    ).extend(sessionKeyPluginActions);

    setSessionKeyClient(sessionKeyClient);
  };

  const readCount = async () => {
    if (!client) return;
    try {
      const countValue = await client.readContract({
        address: registryAddress,
        abi: registryAbi,
        functionName: 'count',
        args: [client.getAddress({ account: client.account! })],
      });
      setCountValue(countValue as number);
      console.log('Count value:', countValue);
    } catch (error) {
      console.error('Error reading count:', error);
    }
  };

  const commitThis = async () => {
    if (!sessionKeySigner || !sessionKeyClient) return;
    setLoading(true);

    const data = encodeFunctionData({
      abi: registryAbi,
      functionName: 'increament1',
    });

    const sessionKeyAddress = await sessionKeySigner.getAddress();
    const result = await sessionKeyClient.executeWithSessionKey({
      args: [
        [
          {
            target: registryAddress,
            value: 0n,
            data: data,
          },
        ],
        sessionKeyAddress,
      ],
    });

    console.log(result);
    setLoading(false);
    readCount();
  };

  const revealThis = async () => {
    if (!sessionKeySigner || !sessionKeyClient) return;
    setLoading(true);

    const data = encodeFunctionData({
      abi: registryAbi,
      functionName: 'increament2',
    });

    const sessionKeyAddress = await sessionKeySigner.getAddress();
    const result = await sessionKeyClient.executeWithSessionKey({
      args: [
        [
          {
            target: registryAddress,
            value: 0n,
            data: data,
          },
        ],
        sessionKeyAddress,
      ],
    });

    console.log(result);
    setLoading(false);
    readCount();
  };

  return (
    <div className={styles.page}>
      {!isConnected ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : (
        <>
          <div>{countValue}</div>
          <button onClick={readCount}>Refresh Count</button>
          <div>{isLoading ? 'Waiting tx to be mined...' : ''}</div>
          <button onClick={commitThis}>Commit this with Signature</button>
          <button onClick={revealThis}>Reveal this with Signature</button>
        </>
      )}
    </div>
  );
}
