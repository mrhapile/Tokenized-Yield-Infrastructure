# farm-tokenization features

[x] Create Your Farm-tokens With Fixed Quantity And Price. <br>
[x] Buy Shares Of A Farm. <hr>
[ ] Deposite Farm Revenue.  
[ ] Widraw From Revenue Vault.

## Getting Started

### Installation


```shell
git clone 
```

#### Install Dependencies

```shell
bun install
```

## Apps

### anchor

This is a Solana program written in Rust using the Anchor framework.

#### Commands

You can use any normal anchor commands. Either move to the `anchor` directory and run the `anchor` command or prefix the
command with `bun`, eg: `bun anchor`.

#### Sync the program id:

Running this command will create a new keypair in the `anchor/target/deploy` directory and save the address to the
Anchor config file and update the `declare_id!` macro in the `./src/lib.rs` file of the program.

You will manually need to update the constant in `anchor/lib/counter-exports.ts` to match the new program id.

```shell
bun anchor keys sync
```

#### Build the program:

```shell
bun anchor-build
```

#### Start the test validator with the program deployed:

```shell
bun anchor-localnet
```

#### Run the tests

```shell
bun anchor-test
```

#### Deploy to Devnet

```shell
bun anchor deploy --provider.cluster devnet
```

### web

This is a NextJs app that uses the Anchor generated client to interact with the Solana program.

#### Commands

Start the web app

```shell
bun dev
```

Build the web app

```shell
bun build
```
