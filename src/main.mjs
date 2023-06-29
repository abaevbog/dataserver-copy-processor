import { SQSClient, ReceiveMessageCommand } from "@aws-sdk/client-sqs";
import config from "config";
const sqsClient = new SQSClient();
import fetch from 'node-fetch';

/**
 * The function processing SQS events added by dataserver on COPY method for items
 */
export const main = async function (event) {
	for (let record of event.Records) {
		const body = JSON.parse(record.body);
		// Go through all levels from the top to bottom
		// Create main item first, then attachments/notes, then annotations
		for (let itemGroup of body.items) {
			const keys = [];
			for (let item of itemGroup) {
				keys.push(item.key);
				delete item.key;
				delete item.version;
				delete item.dateAdded;
			}
			// Request to dataserver to create copy of the items from the group
			let response = await fetch(body.libraryUri + '/items', {
				method: 'post',
				body: JSON.stringify(itemGroup),
				headers: {
					'Content-Type': 'application/json',
					Authorization: 'Basic ' + Buffer.from(config.rootUsername + ":" + config.rootPassword).toString('base64')
				}
			});
			let responseResult = await response.text();
			let data = JSON.parse(responseResult);

			// Substitute parentItem from the event for the key of item we just created
			for (let index of Object.keys(data.successful)) {
				const createdItem = data.successful[index];
				for (let group of body.items) {
					for (let item of group) {
						if (item.parentItem == keys[index]) {
							item.parentItem = createdItem.key;
						}
					}
				}
			}
		}
	}
};
