// todo locale aware formatting & internationalization

// helper for user friendly time string
function printTime(t) {
	let str = t.toLocaleTimeString('en-US', { timeStyle: 'short' });
	if (t.toDateString() != new Date().toDateString()) {
		str = t.toLocaleString('en-US', {day: 'numeric', month: 'short'}) + ", " + str;
	}
	return str;
}

// create button in message display popup
function createButton(msg, parentDiv, label, time) {
	let button = document.createElement('button');
	button.innerText = label + " (" + printTime(time) + ")";
	button.onclick = () => {
		postponeMessage(msg, time);
		window.close();
	}
	let lineBreak = document.createElement('br');
	parentDiv.append(button);
	parentDiv.append(lineBreak);
}

async function postponeMessage(msg, d) {
	let response = await browser.runtime.sendMessage({
		command: "postponeMessage",
		headerMessageId: msg.headerMessageId,
		date: d
	});
	return response.status;
}

async function unpostponeMessage(msg,) {
	let response = await browser.runtime.sendMessage({
		command: "unpostponeMessage",
		headerMessageId: msg.headerMessageId
	});
	return response.status;
}

// gets date to which message is postponed or null if not postponed
async function getPostponedDate(msg) {
	let response = await browser.runtime.sendMessage({
		command: "getPostponedDate",
		headerMessageId: msg.headerMessageId
	});
	let date = response.date;
	return date;
}

async function load() {
	
	const thoondDiv = document.getElementById("thoond-times");
	
	let tabs = await messenger.tabs.query({active: true, currentWindow: true});
	let message = await messenger.messageDisplay.getDisplayedMessage(tabs[0].id);
	
	let postponedDate = await getPostponedDate(message);
	
	if (postponedDate) {
			
		let postponedLine = document.createTextNode('Postponed to ' + printTime(postponedDate));
		thoondDiv.append(postponedLine)
		let lineBreak = document.createElement('br');
		thoondDiv.append(lineBreak)
		let unpostponeButton = document.createElement('button');
		unpostponeButton.innerText = 'Unpostpone';
		unpostponeButton.onclick = () => {
			unpostponeMessage(message);
			window.close();
		}
		thoondDiv.append(unpostponeButton);
		
	} else {
		
		// generate buttons
		// +1h
		{
			const buttonDate = new Date();
			buttonDate.setHours(buttonDate.getHours() + 1);
			createButton(message, thoondDiv, "Later today", buttonDate);
		}
		
		// +1d at 8
		{
			const buttonDate = new Date();
			buttonDate.setHours(8);
			buttonDate.setMinutes(0);
			buttonDate.setDate(buttonDate.getDate() + 1);
			createButton(message, thoondDiv, "Tommorow", buttonDate);
		}
		
		// weekend
		{
			const buttonDate = new Date();
			buttonDate.setHours(8);
			buttonDate.setMinutes(0);
			// 13 = saturday (6) + week to avoid negatives (7)
			let toWeekend = (13 - buttonDate.getDay()) % 7;
			if (toWeekend === 0) toWeekend = 7; 
			buttonDate.setDate(buttonDate.getDate() + toWeekend);
			createButton(message, thoondDiv, "Next weekend", buttonDate);
		}
		
		// next week
		{
			const buttonDate = new Date();
			buttonDate.setHours(8);
			buttonDate.setMinutes(0);
			// 8 = monday (1) + week to avoid negatives (7)
			let toMonday = (8 - buttonDate.getDay()) % 7;
			if (toMonday === 0) toMonday = 7;
			buttonDate.setDate(buttonDate.getDate() + toMonday);
			createButton(message, thoondDiv, "Next week", buttonDate);
		}
		
		// custom <br><input type="datetime-local" value="2022-10-26T12:16"/><button>Other</button>-->
		{
			const dateInput = document.createElement("input");
			const timeNow = new Date();
			dateInput.setAttribute("type", "datetime-local");
			dateInput.setAttribute("value", timeNow.toISOString().split('.')[0]);
			
			const button = document.createElement('button');
			button.innerText = "Custom";
			button.onclick = () => {
				const dateInputValue = dateInput.valueAsDate;
				dateInputValue.setMinutes(dateInputValue.getMinutes() + new Date().getTimezoneOffset());
				postponeMessage(message , dateInputValue);
				window.close();
			}
			
			thoondDiv.append(dateInput);
			thoondDiv.append(button);
		}
	
	}
	
}

document.addEventListener("DOMContentLoaded", load);