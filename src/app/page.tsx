'use client';
/* eslint-disable @typescript-eslint/no-unused-vars */
import { LocalAccountSigner } from '@aa-sdk/core';
import { alchemy, sepolia } from '@account-kit/infra';
import {
  SessionKeyAccessListType,
  SessionKeyPermissionsBuilder,
  SessionKeyPlugin,
  SessionKeySigner,
  createModularAccountAlchemyClient,
  sessionKeyPluginActions,
} from '@account-kit/smart-contracts';
import { encodeFunctionData, Hex, zeroHash } from 'viem';
import styles from './page.module.css';
import {
  abi as registryAbi,
  address as registryAddress,
} from './RegistryContract';
import { useEffect, useState } from 'react';

const API_KEY = process.env.NEXT_PUBLIC_API_KEY as string;
console.log('process.env.API_KEY', process.env.NEXT_PUBLIC_API_KEY);
const PRIVATE_KEY = process.env.NEXT_PUBLIC_PRIVATE_KEY as Hex;

export default function Home() {
  const [client, setClient] = useState<any>();
  const [isLoading, setLoading]= useState<boolean>(false);
  const [sessionKeySigner, setSessionKeySigner] = useState<SessionKeySigner>();
  const [countValue, setCountValue] = useState<number>();
  const chain = sepolia;
  const transport = alchemy({ apiKey: API_KEY });
  const signer = LocalAccountSigner.privateKeyToAccountSigner(PRIVATE_KEY);

  useEffect(() => {
    (async () => {
      console.log('signer', signer);
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
    })();
  }, []);

  async function readCount() {
    try {
      const countValue = await client.readContract({
        address: registryAddress,
        abi: registryAbi,
        functionName: 'count',
        args: [client.getAddress({ account: client.account })],
      });
      setCountValue(countValue);

      console.log('Count value:', countValue);
    } catch (error) {
      console.error('Error reading count:', error);
    }
  }

  async function commitThis() {
    setLoading(true);
    if (!sessionKeySigner) return;
    const sessionKeyAddress = await sessionKeySigner.getAddress();
    // 1. check if the plugin is installed
    const isPluginInstalled = await client
      .getInstalledPlugins({})
      // This checks using the default address for the chain, but you can always pass in your own plugin address here as an override
      .then((x: any) => x.includes(SessionKeyPlugin.meta.addresses[chain.id]));

    // 2. if the plugin is not installed, then install it and set up the session key
    if (!isPluginInstalled) {
      // lets create an initial permission set for the session key giving it an eth spend limit
      const initialPermissions = new SessionKeyPermissionsBuilder()
        .setNativeTokenSpendLimit({
          spendLimit: 1n,
        })
        // this will allow the session key plugin to interact with all addresses
        .setContractAccessControlType(SessionKeyAccessListType.ALLOW_ALL_ACCESS)
        .setTimeRange({
          validFrom: Math.round(Date.now() / 1000),
          // valid for 1 hour
          validUntil: Math.round(Date.now() / 1000 + 60 * 60),
        });
      console.log('we are here initialPermissions');

      console.log(
        'await sessionKeySigner.getAddress()',
        await sessionKeySigner.getAddress()
      );

      const { hash } = await client.installSessionKeyPlugin({
        // 1st arg is the initial set of session keys
        // 2nd arg is the tags for the session keys
        // 3rd arg is the initial set of permissions
        args: [[sessionKeyAddress], [zeroHash], [initialPermissions.encode()]],
      });

      console.log('we are here installSessionKeyPlugin');

      await client.waitForUserOperationTransaction({ hash });
    }

    // 3. set up a client that's using our session key
    const sessionKeyClient = (
      await createModularAccountAlchemyClient({
        chain,
        signer: sessionKeySigner,
        transport,
        // this is important because it tells the client to use our previously deployed account
        accountAddress: client.getAddress({ account: client.account }),
      })
    ).extend(sessionKeyPluginActions);

    const data = encodeFunctionData({
      abi: registryAbi,
      functionName: 'increament1',
    });

    // 4. send a user operation using the session key
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
  }

  async function revealThis() {
    setLoading(true);
    if (!sessionKeySigner) return;
    const sessionKeyAddress = await sessionKeySigner.getAddress();
    const sessionKeyClient = (
      await createModularAccountAlchemyClient({
        chain,
        signer: sessionKeySigner,
        transport,
        // this is important because it tells the client to use our previously deployed account
        accountAddress: client.getAddress({ account: client.account }),
      })
    ).extend(sessionKeyPluginActions);

    const data = encodeFunctionData({
      abi: registryAbi,
      functionName: 'increament2',
    });

    // 4. send a user operation using the session key
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
  }
  return (
    <div className={styles.page}>
      <div></div>
      <div>{countValue}</div>
      <button onClick={readCount}>Refresh Count</button>
      <div>{isLoading ? 'Waiting tx to be mined...' : '' }</div>
      <button onClick={commitThis}>Commit this with Signature</button>
      <button onClick={revealThis}>Reveal this with Signature</button>
    </div>
  );
}
