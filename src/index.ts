import * as anchor from '@project-serum/anchor';
import axios from 'axios';
import { IDL } from './idl';

(async function () {
  try {
    const { Keypair, PublicKey, Connection, clusterApiUrl, Transaction } =
      anchor.web3;
    const connection = new Connection(clusterApiUrl('devnet'));
    const programId = new PublicKey(
      'J7LJ7HzLempQhpvnMpPvFrXLV6u5puKjzR1wrope3iUM'
    );

    const fakePhantomWallet = new anchor.Wallet(
      Keypair.fromSecretKey(
        Uint8Array.from([
          81, 223, 147, 28, 174, 104, 19, 143, 16, 246, 177, 177, 23, 12, 86,
          203, 227, 139, 30, 103, 80, 10, 240, 82, 52, 32, 33, 153, 74, 133,
          227, 40, 252, 27, 155, 95, 127, 130, 192, 132, 139, 52, 168, 243, 36,
          174, 211, 19, 31, 97, 111, 99, 183, 209, 71, 158, 127, 185, 128, 41,
          206, 27, 179, 184,
        ])
      )
    );

    console.log('Phantom address', fakePhantomWallet.publicKey.toString());

    const reallocProgram = new anchor.Program(
      IDL,
      programId,
      new anchor.AnchorProvider(connection, fakePhantomWallet, {
        commitment: 'confirmed',
      })
    );

    const incrementIx = await reallocProgram.methods
      .writeState()
      .accounts({
        stateAccount: (
          await PublicKey.findProgramAddress([Buffer.from('state')], programId)
        )[0],
        authority: new PublicKey(
          '6T6JHiXK3qengEGY7axogAeMMeGPLS8sCJYLnBfsqQQo'
        ),
      })
      .instruction();

    const recentBlockhash = await connection.getLatestBlockhash();
    const transaction = new Transaction({
      ...recentBlockhash,
      feePayer: fakePhantomWallet.publicKey,
    }).add(incrementIx);

    const {
      data: {
        txData: { data: partialSignedTxData },
      },
    } = await axios.post('http://localhost:4000/sign', {
      txData: transaction.serialize({ requireAllSignatures: false }),
    });

    const partialSignedTx = Transaction.from(partialSignedTxData);
    const fullySignedTx = await fakePhantomWallet.signTransaction(
      partialSignedTx
    );

    const isVerified = fullySignedTx.verifySignatures();

    if (!isVerified) {
      throw new Error('Transaction not fully signed');
    }

    const txHash = await connection.sendRawTransaction(
      fullySignedTx.serialize()
    );

    await connection.confirmTransaction(
      {
        signature: txHash,
        ...recentBlockhash,
      },
      'confirmed'
    );

    console.log(`Done :), ${txHash}`);
  } catch (err) {
    console.error(err);
  }
})();
