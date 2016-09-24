var builder = require("botbuilder"),
	restify = require("restify");

/*
	Notes:

	data can be persisted in many ways:
	- session.userData: global info for the user across all conversations
	- session.conversationData: global info for a single conversation, visible to everyone in conversation (disabled by default)
	- session.privateConversationData: global info for a single conversation, but private data for current user (cleaned up when conversation over)
	- session.dialogData: info for a single dialog instance (temp info between waterfall steps)

	do NOT store data using global vars or function closures!
*/

/**
 * Bot Setup
 */

// restify server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
	console.log("%s listening to %s", server.name, server.url);
});

// create chat bot
var connector = new builder.ChatConnector({
		appId: process.env.MICROSOFT_APP_ID,
		appPassword: process.env.MICROSOFT_APP_PASSWORD
	}),
	bot = new builder.UniversalBot(connector);

server.post("/api/messages", connector.listen());

/**
 * Bots Dialogs
 */

var intents = new builder.IntentDialog();
bot.dialog("/", intents);

intents.matches(/^change name/i, [
	function (session) {
		session.beginDialog("/profile");
	},
	function (session, results) {
		session.send("Ok... Changed your name to %s", session.userData.name);
	}
]);

intents.onDefault([
	function (session, args, next) {
		if (!session.userData.name) {
			session.beginDialog("/profile");
		} else {
			next();
		}
	},

	function (session, results) {
		session.send("Hello %s!", session.userData.name);
	}
]);

bot.dialog("/profile", [
	function (session) {
		builder.Prompts.text(session, "Hi! What is your name?");
	},

	function (session, results) {
		session.userData.name = results.response;
		session.endDialog();
	}
]);
