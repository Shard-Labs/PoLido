import * as dotenv from "dotenv";
import * as hre from "hardhat";
import fs from "fs";
import path from "path";

import * as config from "../FxPortalConfig/config.json";

import { FxStateRootTunnel__factory } from "../typechain";
import { DeployDetails } from "./types";

dotenv.config({ path: __dirname.concat("/.env") });

async function main () {
    let fxRoot, checkpointManager;

    const network = await hre.ethers.provider.getNetwork();

    if (network.chainId === 1) {
    // Polygon Mainnet
        fxRoot = config.mainnet.fxRoot.address;
        checkpointManager = config.mainnet.checkpointManager.address;
    } else if (network.chainId === 5) {
    // Mumbai Testnet
        fxRoot = config.testnet.fxRoot.address;
        checkpointManager = config.testnet.checkpointManager.address;
    } else {
        fxRoot = process.env.FX_ROOT;
        checkpointManager = process.env.CHECKPOINT_MANAGER;
    }

    const FxStateRootTunnel = (await hre.ethers.getContractFactory(
        "FxStateRootTunnel"
    )) as FxStateRootTunnel__factory;
    const fxStateRootTunnel = await FxStateRootTunnel.deploy(
    checkpointManager!,
    fxRoot!
    );
    await fxStateRootTunnel.deployTransaction.wait();

    console.log("FxStateRootTunnel deployed to:", fxStateRootTunnel.address);

    const filePath = path.join(
        process.cwd(),
        "deploy-" + hre.network.name + ".json"
    );

    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, JSON.stringify({}));
    }

    const goerliData: DeployDetails = JSON.parse(
        fs.readFileSync(filePath, { encoding: "utf-8" })
    );

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            { ...goerliData, fx_state_root_tunnel: fxStateRootTunnel.address },
            null,
            4
        ),
        "utf8"
    );
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
