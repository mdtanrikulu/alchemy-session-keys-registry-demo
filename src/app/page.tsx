'use client';
/* eslint-disable @typescript-eslint/no-unused-vars */
import { WalletClientSigner } from '@aa-sdk/core';
import {
  alchemy,
  sepolia,
} from '@account-kit/infra';
import {
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

const API_KEY = process.env.NEXT_PUBLIC_API_KEY as string;
const chain = sepolia;

export default function Home() {
  const [client, setClient] = useState<any>();
  const [maBalance, setMABalance] = useState<number>(0);
  const [sessionKeyClient, setSessionKeyClient] = useState<any>();
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setLoading] = useState<boolean>(false);
  const [sessionKeySigner, setSessionKeySigner] = useState<SessionKeySigner>();
  const [countValue, setCountValue] = useState<number>();
  const [txHashes, setTxHashes] = useState<string[]>([]); // State to track transaction hashes
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
      }
    })();
  }, []);

  useEffect(() => {
    if (!client) return;
    (async () => {
      setMABalance(await client.getBalance({ address: client.getAddress() }));
    })();
  }, [client])

  const connectWallet = async () => {
    try {
      const accounts = await walletClient.request({
        method: 'eth_requestAccounts',
      });
      if (accounts.length > 0) {
        setIsConnected(true);
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

    const client = (
      await createModularAccountAlchemyClient({
        chain,
        transport,
        signer,
      })
    ).extend(sessionKeyPluginActions);
    setClient(client);
  };

  const installPlugin = async () => {
    if (!client || !sessionKeySigner) return;
    const isPluginInstalled = await client
      .getInstalledPlugins({})
      .then((x: any) => {
        console.log(x);
        return x.includes(SessionKeyPlugin.meta.addresses[chain.id]);
      });

    const sessionKeyAddress = await sessionKeySigner.getAddress();
    console.log('isPluginInstalled', isPluginInstalled);

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
      // const result = await client.updateSessionKeyPermissions({
      //   key: sessionKeyAddress,
      //   permissions: new SessionKeyPermissionsBuilder()
      //     .setNativeTokenSpendLimit({ spendLimit: 1n })
      //     .setContractAccessControlType(
      //       SessionKeyAccessListType.ALLOW_ALL_ACCESS
      //     )
      //     .setTimeRange({
      //       validFrom: Math.round(Date.now() / 1000),
      //       // valid for 1 hour
      //       validUntil: Math.round(Date.now() / 1000 + 60 * 60),
      //     })
      //     .encode(),
      // });
      // console.log('update result', result);
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
    setTxHashes((prev) => [...prev, result.hash]); // Add transaction hash to state
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
    setTxHashes((prev) => [...prev, result.hash]); // Add transaction hash to state
    setLoading(false);
    readCount();
  };

  return (
    <div className={styles.page}>
      {!isConnected ? (
        <button onClick={connectWallet}>Connect Wallet</button>
      ) : !client ? (
        <>
          <button onClick={initializeClient}>Sign to create SCA</button>
        </>
      ) : (
        <>
          <div>{countValue}</div>
          <button onClick={readCount}>Refresh Count</button>
          <div>{isLoading ? 'Waiting tx to be mined...' : ''}</div>
          <button onClick={installPlugin}>Install plugin</button>
          <button onClick={commitThis}>Commit this with Signature</button>
          <button onClick={revealThis}>Reveal this with Signature</button>
          <fieldset>
            <legend>Modular Account:</legend>
            <div>
              Address: {client.getAddress({ account: client.account! })}
            </div>
            <div>
              Balance: {maBalance}
            </div>
          </fieldset>
          <h3>Transaction Hashes:</h3>
          <ul>
            {txHashes.map((hash, index) => (
              <li key={index}>{hash}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
