import * as config from "../FxPortalConfig/config.json";

import * as dotenv from "dotenv";
import * as hre from "hardhat";
import fs from "fs";
import path from "path";

import { FxStateChildTunnel__factory } from "../typechain";
import { DeployDetails } from "./types";

dotenv.config({ path: __dirname.concat("/.env") });

async function main () {
    let fxChild;

    const network = await hre.ethers.provider.getNetwork();

    if (network.chainId === 137) {
    // Polygon Mainnet
        fxChild = config.mainnet.fxChild.address;
    } else if (network.chainId === 80001) {
    // Mumbai Testnet
        fxChild = config.testnet.fxChild.address;
    } else {
        fxChild = process.env.FX_CHILD;
    }

    const networkName = hre.network.name === "mumbai" ? "goerli" : "polygon";
    const filePath = path.join(process.cwd(), "deploy-" + networkName + ".json");

    const goerliData: DeployDetails = JSON.parse(
        fs.readFileSync(filePath, { encoding: "utf-8" })
    );

    const FxStateChildTunnel = (await hre.ethers.getContractFactory(
        "FxStateChildTunnel"
    )) as FxStateChildTunnel__factory;
    const fxStateChildTunnel = await FxStateChildTunnel.deploy(fxChild!);
    await fxStateChildTunnel.deployTransaction.wait();

    await fxStateChildTunnel.setFxRootTunnel(goerliData.fx_state_root_tunnel);

    console.log("FxStateChildTunnel deployed to:", fxStateChildTunnel.address);

    fs.writeFileSync(
        filePath,
        JSON.stringify(
            { ...goerliData, fx_state_child_tunnel: fxStateChildTunnel.address },
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
