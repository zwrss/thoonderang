let db = {};

// helper for user friendly time string
function printTime(t) {
	let str = t.toLocaleTimeString('en-US', { timeStyle: 'short' });
	if (t.toDateString() != new Date().toDateString()) {
		str = t.toLocaleString('en-US', {day: 'numeric', month: 'short'}) + ", " + str;
	}
	return str;
}

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
	return { status: 'success' };
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

async function postponeMessage(hmId, date) {
	db[hmId] = date;
	saveDB();
	var msgQuery = await messenger.messages.query({ headerMessageId: hmId});
	var msg = msgQuery.messages[0];
	var postponedFolder = await assuredDir(msg.folder.accountId);
	await messenger.messages.move([msg.id], postponedFolder);
	await messenger.notifications.create({
		"type": "basic",
		"iconUrl": "icons/thoonderang-32px.png",
		"title": "Message postponed",
		"message": "Message will appear in inbox at " + printTime(date)
	});     
	return { status: 'success' };
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
				return await postponeMessage(message.headerMessageId, message.date);
            case "unpostponeMessage":
				return await unpostponeMessage(message.headerMessageId);
        }
		
    } 
	
});

// Create the menu entries.
const menuRootId = await messenger.menus.create({
    title: "Postpone",
    contexts: ["message_list"],
});

const menuEntry1Id = await messenger.menus.create({
    title: "+1h",
    contexts: ["message_list"],
	parentId: menuRootId,
});

const menuEntry2Id = await messenger.menus.create({
    title: "+1d",
    contexts: ["message_list"],
	parentId: menuRootId,
});

const menuEntry3Id = await messenger.menus.create({
    title: "+1w",
    contexts: ["message_list"],
	parentId: menuRootId,
});



// Register a listener for the menus.onClicked event.
await messenger.menus.onClicked.addListener(async (info, tab) => {
	switch (info.menuItemId) {
		case menuEntry1Id:
			var time = new Date();
			time.setHours(time.getHours() + 1);
			info.selectedMessages.messages.forEach(async message => {
				await postponeMessage(message.headerMessageId, time)
			});
			break;
		case menuEntry2Id:
			var time = new Date();
			time.setDate(time.getDate() + 1);
			time.setHours(8);
			time.setMinutes(0);
			info.selectedMessages.messages.forEach(async message => {
				await postponeMessage(message.headerMessageId, time)
			});
			break;
		case menuEntry3Id:
			var time = new Date();
			time.setDate(time.getDate() + 1);
			time.setHours(8);
			time.setMinutes(0);
			// 8 = monday (1) + week to avoid negatives (7)
			var toMonday = (8 - time.getDay()) % 7;
			if (toMonday === 0) toMonday = 7;
			time.setDate(time.getDate() + toMonday);
			info.selectedMessages.messages.forEach(async message => {
				await postponeMessage(message.headerMessageId, time)
			});
			break;
	}
});

async function theLoop() {
	while(true) {
		await checkMessages();
		await new Promise(r => setTimeout(r, 60 * 1000));
	}
}

theLoop();