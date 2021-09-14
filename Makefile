init:
	npm install

compile:
	npx hardhat compile

clean:
	npx hardhat clean
	rm -rf typechain
	rm -rf cache

test:
	npx hardhat test

.PHONY: init compile clean test
