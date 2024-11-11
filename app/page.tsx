"use client";
import { shortenAddress } from "@/utils";
import { CROWDFUNDING_CONTRACT_ABI } from "@/utils/abi";
import { useLogin, usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import {
  createPublicClient,
  erc20Abi,
  http,
  parseAbiItem,
  parseUnits,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  useReadContract,
  useWatchContractEvent,
  useWriteContract,
} from "wagmi";

interface Campaign {
  creator?: `0x${string}`;
  expirationDate?: bigint;
  campaignId?: bigint;
}

export default function Home() {
  const { logout, authenticated, ready, user, createWallet } = usePrivy();
  const { login } = useLogin({
    onComplete: async (user) => {
      console.log("login complete", user);
      if (!user.wallet) {
        const userWallet = await createWallet();
        console.log("new user wallet", userWallet);
      }
    },
  });
  const [prizeGoal, setPrizeGoal] = useState<number>(0);
  const { writeContractAsync } = useWriteContract();
  const [campaigns, setCampaings] = useState<Campaign[]>([]);
  useWatchContractEvent({
    abi: CROWDFUNDING_CONTRACT_ABI,
    address: process.env
      .NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS! as `0x${string}`,
    eventName: "CampaignCreated",
    onLogs: (logs) => {
      console.log("CampaignCreated", logs);
      const log = logs[0];

      setCampaings((prev) => [...prev, log.args]);
    },
  });

  const { data: usdcDecimals } = useReadContract({
    address: process.env.NEXT_PUBLIC_USDC_ADDRESS! as `0x${string}`,
    abi: erc20Abi,
    functionName: "decimals",
  });
  console.log("decimals", usdcDecimals);

  useEffect(() => {
    getPastEvents();
  }, []);

  const getPastEvents = async () => {
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(
        "https://base-sepolia.g.alchemy.com/v2/eC4NNZbOSeM_beZq5uEKRnzC3nisv3e3"
      ),
    });

    const logs = await publicClient.getLogs({
      address: process.env
        .NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS! as `0x${string}`,
      fromBlock: BigInt(17717804),
      toBlock: "latest",
      event: parseAbiItem(
        "event CampaignCreated(address indexed creator, uint indexed campaignId, uint)"
      ),
    });

    setCampaings(
      logs.map((log) => ({
        creator: log.args[0],
        campaignId: log.args[1],
        expirationDate: log.args[2],
      }))
    );
  };

  const fundCampaign = async (campaignId: bigint, amount: bigint) => {
    // 1. check the user allowance
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(
        "https://base-sepolia.g.alchemy.com/v2/eC4NNZbOSeM_beZq5uEKRnzC3nisv3e3"
      ),
    });

    const allowance = await publicClient.readContract({
      abi: erc20Abi,
      address: process.env.NEXT_PUBLIC_USDC_ADDRESS! as `0x${string}`,
      functionName: "allowance",
      args: [
        user?.wallet!.address as `0x${string}`,
        process.env.NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS! as `0x${string}`,
      ],
    });

    // 2. if the user allowance < amount, approve the contract
    if (allowance < amount) {
      const approveTx = await writeContractAsync({
        abi: erc20Abi,
        address: process.env.NEXT_PUBLIC_USDC_ADDRESS! as `0x${string}`,
        functionName: "approve",
        args: [
          process.env
            .NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS! as `0x${string}`,
          amount,
        ],
      });

      await publicClient.waitForTransactionReceipt({ hash: approveTx });
    }
    // 3. call fundCampaign on the smart contract
    const fundCampaignTx = await writeContractAsync({
      abi: CROWDFUNDING_CONTRACT_ABI,
      address: process.env
        .NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS! as `0x${string}`,
      functionName: "fundCampaign",
      args: [campaignId, amount],
    });

    await publicClient.waitForTransactionReceipt({ hash: fundCampaignTx });
  };

  if (!ready) {
    return (
      <div className="flex justify-center items-center h-screen w-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex justify-between items-center px-4 py-2">
        <h1 className="font-bold">Crowdfunding</h1>
        {authenticated && user && (
          <button
            onClick={() => logout()}
            className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
          >
            {shortenAddress(user?.wallet!.address)}
          </button>
        )}
        {!authenticated && (
          <button
            onClick={() => login()}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Connect
          </button>
        )}
      </div>
      <div className="flex flex-col justify-center items-center space-y-2">
        <input
          className="rounded border border-blue-500 bg-black text-white"
          type="number"
          min="0"
          value={prizeGoal}
          onChange={(e) => setPrizeGoal(parseInt(e.target.value))}
        />
        <button
          onClick={async () => {
            const now = Math.floor(Date.now() / 1000);
            const tomorrow = now + 24 * 60 * 60;
            await writeContractAsync({
              abi: CROWDFUNDING_CONTRACT_ABI,
              address: process.env
                .NEXT_PUBLIC_CROWDFUNDING_CONTRACT_ADDRESS! as `0x${string}`,
              functionName: "createCampaign",
              args: [
                BigInt(tomorrow),
                parseUnits(prizeGoal.toString(), usdcDecimals || 18),
              ],
            });
          }}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold text-sm py-2 px-4 rounded"
        >
          Create Campaign
        </button>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {campaigns.map((campaign) => (
          <div
            key={campaign.campaignId}
            className="rounded border border-gray-500 p-4"
          >
            <p>Creator: {shortenAddress(campaign.creator!)}</p>
            <p>Expiration Date: {campaign.expirationDate}</p>
            <p>Campaign ID: {campaign.campaignId}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
