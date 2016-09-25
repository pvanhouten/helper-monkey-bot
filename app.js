var builder = require("botbuilder"),
	restify = require("restify"),
	google  = require("googleapis"),
	oAuth2  = google.auth.OAuth2,
	scopes  = [
		"https://www.googleapis.com/auth/contacts.readonly",
		"https://www.googleapis.com/auth/userinfo.profile"
	],

	getOAuthClient = function () {
		return new oAuth2(process.env.OAUTH2_CLIENT_ID, process.env.OAUTH2_CLIENT_SECRET, process.env.OAUTH2_REDIRECT_URL);
	};

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
server.use(restify.queryParser());
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

server.get("/api/oauthcallback", function (req, res, next) {
	console.log("OAUTH CALLBACK");
	var authCode = req.query.code,
		address = JSON.parse(req.query.state),
		oauth = getOAuthClient();

	oauth.getToken(authCode, function (err, tokens) {
		if (!err) {
			bot.beginDialog(address, "/oauth-success", tokens);
		}
		res.send(200, {});
	});
});

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
		session.send("Ok... Changed your name to %s", session.privateConversationData.name);
	}
]);

intents.onDefault([
	function (session, args, next) {
		if (!session.privateConversationData.name) {
			session.beginDialog("/profile");
		} else {
			next();
		}
	},

	function (session, results) {
		session.send("Hello %s!", session.privateConversationData.name);
	}
]);

bot.dialog("/profile", [
	function (session) {
		builder.Prompts.text(session, "Hi! What is your name?");
	},

	function (session, results) {
		if (results.response.match(/login/gi)) {
			var oauth = getOAuthClient(),
				url = oauth.generateAuthUrl({ access_type: "online", scope: scopes }) +
					"&state=" + encodeURIComponent(JSON.stringify(session.message.address));;

			session.send(new builder.Message(session).addAttachment(
				new builder.SigninCard(session)
					.text("Authenticate with Google")
					.button("Sign-In", url))
			);
		} else {
			session.privateConversationData.name = results.response;
			session.endDialog();
		}
	}
]);

bot.dialog("/oauth-success", function (session, tokens) {
	var people = google.people("v1"),
		oauth = getOAuthClient();

	session.privateConversationData.tokens = tokens;
	session.send("oAuth Success!");
	oauth.setCredentials(tokens);

	people.people.get({ resourceName: "people/me", auth: oauth }, function (err, response) {
		if (!err) {
			if (response.names && response.names.length > 0) {
				var name = response.names[0].givenName || response.names[0].displayName;
				session.privateConversationData.name = name;
				session.send("Nice to meet you, %s!", name);
			}
		} else {
			session.send("There was an error retrieving your profile.");
		}
		session.endDialog();
	});
});
