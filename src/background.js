let db = {};

async function load() {
	let loadedDB = await browser.storage.local.get("thoonderang");
	if (loadedDB && loadedDB.thoonderang) db = loadedDB.thoonderang;
}

document.addEventListener("DOMContentLoaded", load);

function saveDB() {
	browser.storage.local.set({thoonderang: db});
}

async function getInbox(accountId) {
	let account = await messenger.accounts.get(accountId);
	let folders = await messenger.folders.getSubFolders(account);
	let inboxFolder = null;
	folders.forEach(folder => {
		if (folder.type == "inbox") inboxFolder = folder
	});
	return inboxFolder;
}

async function assuredDir(accountId) {
	let account = await messenger.accounts.get(accountId);
	let folders = await messenger.folders.getSubFolders(account);
	let postponedFolder = null;
	folders.forEach(folder => {
		if (folder.name == "Postponed") postponedFolder = folder
	});
	if (postponedFolder) {
		return postponedFolder;
	} else {
		return await messenger.folders.create(account, "Postponed");
	}
}

async function unpostponeMessage(hmId) {
	delete db[hmId];
	saveDB();
	var msgQuery = await messenger.messages.query({ headerMessageId: hmId});
	var msg = msgQuery.messages[0];
	var inboxFolder = await getInbox(msg.folder.accountId);
	await messenger.messages.move([msg.id], inboxFolder);
	await messenger.messages.update(msg.id, {read:false});
}

async function checkMessages() {
	for (var hmId in db) {
		var datePostponed = db[hmId];
		var timeNow = new Date();
		if (datePostponed <= timeNow) {
			await unpostponeMessage(hmId);
		}
	}
}

// command handler for other parts of the expansion
messenger.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
	
    if (message && message.hasOwnProperty("command")) {
		
		// todo check properties and return status
				
		console.log(message);
				
        switch (message.command) {
            case "getPostponedDate":
				var d = db[message.headerMessageId];
                return { headerMessageId: message.headerMessageId, date: d };
            case "postponeMessage":
                db[message.headerMessageId] = message.date;
				saveDB();
				var msgQuery = await messenger.messages.query({ headerMessageId: message.headerMessageId});
				var msg = msgQuery.messages[0];
				var postponedFolder = await assuredDir(msg.folder.accountId);
				await messenger.messages.move([msg.id], postponedFolder);
				return { status: 'success' };
            case "unpostponeMessage":
				await unpostponeMessage(message.headerMessageId);
				return { status: 'success' };
        }
		
    } 
	
});

async function theLoop() {
	while(true) {
		await checkMessages();
		await new Promise(r => setTimeout(r, 60 * 1000));
	}
}

theLoop();