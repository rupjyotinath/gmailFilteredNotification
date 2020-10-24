/**
 * Returns a concised version of message Object, which removes all unnecessary data
 * @param {Object} message The email message object obtained from a users.messages.get 
 * @returns {Object} concisedMessage
 */
function conciseMessage(message){
    const concisedMessage={};

    if(!message.id && !message.snippet && message.payload && message.payload.headers){
        throw new Error("message passed to conciseMessage not proper, id, snippet, headers missing")
    }
    concisedMessage.id=message.id;
    concisedMessage.snippet=message.snippet;

    const messageHeaders=message.payload.headers;
    // console.log(messageHeaders);
    const headerFrom=messageHeaders.find(({name})=>name==='From');
    console.log(headerFrom)

    if(headerFrom){
        concisedMessage.from=headerFrom.value;
    }

    let senderName;
    let senderEmail;
    if(headerFrom){
        const headerFromValue=headerFrom.value.split(" <");
        console.log(headerFromValue)
        if(headerFromValue.length===2){
            senderName=headerFromValue[0];
            senderEmail=headerFromValue[1];
            senderEmail=senderEmail.substring(0,senderEmail.length-1);
        }
        else{
            senderEmail=headerFromValue[0];
            senderEmail=senderEmail.substring(0,senderEmail.length);
        }        
        if(!senderName && senderEmail){
            senderName=senderEmail.split("@")[0];
        }
    }

    let domain;
    if(senderEmail){
        domain=senderEmail.split("@")[1];
    }

    concisedMessage.senderEmail=senderEmail;
    concisedMessage.senderName=senderName;
    concisedMessage.domain=domain;

    console.log(concisedMessage);

    return concisedMessage;
}

/**
 * Generic function that filters a message based on a filter property
 * @param {Object} message message Object containg id,labelIds & threadId
 * @param {Object} values Object labels/emailIds/domains which is present as a property in filter Object
 * @param {string} property Property/Key in message object
 * @returns Boolean True if matched with filter, false otherwise
 */
function filterMessageBasedOnProperty(message,values,property){
    if(values.include.length){
        let pass=false;
        for(const label of values.include){
            if(message[property].indexOf(label)!=-1){
                pass=true;
                break;
            }
        };
        return pass;
    }
    else if(values.exclude.length){
        console.log(message[property])
        let pass=true;
        for(const label of values.exclude){
            if(message[property].indexOf(label)!=-1){
                pass=false;
                break;
            }
        };
        return pass;
    }
    else{
        return true;
    }
}

function filterMessageBasedOnLabels(message,labels){
    return filterMessageBasedOnProperty(message,labels,"labelIds");
}

function filterMessageBasedOnEmailIds(message,emailIds){
    return filterMessageBasedOnProperty(message,emailIds,"senderEmail");
}

function filterMessageBasedOnDomains(message,domains){
    return filterMessageBasedOnProperty(message,domains,"domain");
}

function filterMessage(message,filter){
    const emailPass=filterMessageBasedOnEmailIds(message,filter.emailIds);
    if(filter.emailIds.include.length>0){
        return  emailPass;  // Emails present on include means only actively monitor that particular emails, returning directly the outcome
    }
    else if(filter.emailIds.exclude.length>0){
        if(emailPass){
            // Check if domain filter enabled, in that case, will return the domainPass
            if(filter.emailIds.domainFilter){
                return filterMessageBasedOnDomains(message,filter.domains);
            }
            return emailPass; // return True
        }
        else{
            return emailPass; // return False ; The email is present in excluded list, will not allow.
        }
    }
    else{
        // Nothing in Email filter, will check Domain filter
        const domainPass =filterMessageBasedOnDomains(message,filter.domains);
        return domainPass; 
        /*
        Todo: Implement the Social Filter for future version
        */
    }
}

module.exports={
    conciseMessage,
    filterMessageBasedOnLabels,
    filterMessageBasedOnProperty,
    filterMessage
}