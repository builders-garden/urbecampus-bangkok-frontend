"use client";
import { shortenAddress } from "@/utils";
import { useLogin, usePrivy } from "@privy-io/react-auth";

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

  console.log(user);

  if (!ready) {
    return (
      <div className="flex justify-center items-center h-screen w-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center h-screen w-screen">
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
  );
}
