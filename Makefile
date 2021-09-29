init:
	npm install

compile:
	npx hardhat compile

clean:
	npx hardhat clean

test:
	npx hardhat test

PHONY: init compile clean test