var builder = require("botbuilder"),
	connector = new builder.ConsoleConnector().listen(),
	bot = new builder.UniversalBot(connector),
	intents = new builder.IntentDialog();

/*
	data can be persisted in many ways:
	- session.userData: global info for the user across all conversations
	- session.conversationData: global info for a single conversation, visible to everyone in conversation (disabled by default)
	- session.privateConversationData: global info for a single conversation, but private data for current user (cleaned up when conversation over)
	- session.dialogData: info for a single dialog instance (temp info between waterfall steps)

	do NOT store data using global vars or function closures!
*/

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
