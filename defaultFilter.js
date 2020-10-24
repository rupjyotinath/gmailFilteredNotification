/**
 * Default filters
 * 
 * The Sytem labels provided by Gmail and received by this application
 * are :
 * UNREAD, CATEGORY_SOCIAL, CATEGORY_PROMOTIONS, CATEGORY_PERSONAL,
 * CATEGORY_UPDATES, CATEGORY_FORUMS, IMPORTANT, INBOX, STARRED
 */
const defaultFilter={
    "labels":{
        "include":[],
        "exclude":["CATEGORY_SOCIAL","CATEGORY_PROMOTIONS"]
    },
    "emailIds":{
        "include":["abc@example.com"],
        "exclude":["def@example.com"],
        "domainFilter":true
    },
    "domains":{
        "include":["linkedin.com","indeed.co.in"],
        "exclude":["glassdoor.com"],
        "socialFilter":false
    },
    "social":{
        "linkedin":{
            "include":["NEW_MESSAGE","CONNECTION_REQUEST"],
            "exclude":["CONNECTION_ACCEPTED"]
        }
    }

}

module.exports=defaultFilter;