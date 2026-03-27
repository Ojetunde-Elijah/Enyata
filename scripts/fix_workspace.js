import { readWorkspace, writeWorkspace } from '../server/workspaceStore.js';
import { getWalletDetails } from '../server/interswitch.js';

async function fix() {
  const ws = await readWorkspace();
  if (!ws) {
    console.error("No workspace found.");
    return;
  }

  // The user's mobile number from logs
  const mobileNo = '07065871087';
  const inter = ws.profile.interswitch;

  console.log(`Attempting to recover wallet details for ${mobileNo}...`);
  try {
    const details = await getWalletDetails(inter, mobileNo);
    if (details && details.virtualAccount) {
      ws.profile.virtualWallet = details;
      // Also store mobileNo/firstName for future robustness
      ws.profile.mobileNo = mobileNo;
      ws.profile.firstName = ws.profile.firstName || 'Merchant';
      
      await writeWorkspace(ws);
      console.log("SUCCESS: Workspace updated with virtual account details.");
      console.log("Account Number:", details.virtualAccount.accountNumber);
      console.log("Bank:", details.virtualAccount.bankName);
    } else {
      console.error("FAILED: Response did not contain virtualAccount.", JSON.stringify(details, null, 2));
    }
  } catch (e) {
    console.error("ERROR during recovery:", e.message);
  }
}

fix();
