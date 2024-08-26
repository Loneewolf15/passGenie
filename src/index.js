const { ethers } = require("ethers");

const rollup_server = process.env.ROLLUP_HTTP_SERVER_URL;
console.log("HTTP rollup_server url is " + rollup_server);

function str2hex(payload) {
  return ethers.hexlify(ethers.toUtf8Bytes(payload));
}

function hex2str(hex) {
  return ethers.toUtf8String(ethers.arrayify(hex));
}

function isNum(num) {
  return !isNaN(num);
}

function generateRandomPassword(input) {
  const minLength = 8;
  const maxLength = 12;
  const length =
    Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;

  // Shuffle the input and pick characters to create a random password
  const shuffledInput = input
    .split("")
    .sort(() => 0.5 - Math.random())
    .join("");
  return shuffledInput.slice(0, length);
}

let users = [];
let generatedPasswordsCount = 0;

async function handle_advance(data) {
  console.log("Received advance request data " + JSON.stringify(data));

  const metadata = data["metadata"];
  const payload = data["payload"];
  const sender = data["msg_sender"];

  let word = hex2str(payload);
  if (!word || word.length < 1) {
    const report_req = await fetch(rollup_server + "/report", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ payload: str2hex("Invalid input") }),
    });
    return "reject";
  }

  // Generate a random password based on the input
  const password = generateRandomPassword(word);
  users.push(sender);
  generatedPasswordsCount += 1;

  const notice_req = await fetch(rollup_server + "/notice", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: str2hex(password) }),
  });

  console.log("Generated password: " + password);

  return "accept";
}

async function handle_inspect(data) {
  console.log("Received inspect request data " + JSON.stringify(data));

  const payload = data["payload"];
  const route = hex2str(payload);

  let resObj;
  if (route === "list") {
    resObj = JSON.stringify({ users });
  } else if (route === "total") {
    resObj = JSON.stringify({ generatedPasswordsCount });
  } else {
    resObj = "Route not implemented";
  }

  const report_req = await fetch(rollup_server + "/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ payload: str2hex(resObj) }),
  });

  return "accept";
}

var handlers = {
  advance_state: handle_advance,
  inspect_state: handle_inspect,
};

var finish = { status: "accept" };

(async () => {
  while (true) {
    const finish_req = await fetch(rollup_server + "/finish", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "accept" }),
    });

    console.log("Received finish status " + finish_req.status);

    if (finish_req.status == 202) {
      console.log("No pending rollup request, trying again");
    } else {
      const rollup_req = await finish_req.json();
      var handler = handlers[rollup_req["request_type"]];
      finish["status"] = await handler(rollup_req["data"]);
    }
  }
})();
