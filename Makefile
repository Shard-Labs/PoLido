init:
	npm install

compile:
	NODE_ENV=test npx hardhat compile

clean:
	npx hardhat clean
	rm -rf typechain
	rm -rf cache

test:
	npx hardhat test

deploy-mainnet:
	npx hardhat run --network mainnet scripts/deploy.ts

deploy-goerli:
	npx hardhat run --network goerli scripts/deploy_root.ts
	npx hardhat run --network mumbai scripts/deploy_child.ts
	npx hardhat run --network goerli scripts/deploy.ts

deploy-localhost:
	npx hardhat run --network localhost scripts/deploy.ts

verify-goerli:
	npx hardhat run verifyLido --network goerli

.PHONY: init compile clean test