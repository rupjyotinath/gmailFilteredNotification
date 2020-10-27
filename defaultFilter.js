/**
 * Default filters
 * This filter is used if there is any error in user provided filter info in filter.json file
 */
const defaultFilter={
    "labels":{
        "include":[],
        "exclude":["CATEGORY_SOCIAL","CATEGORY_PROMOTIONS"]
    },
    "emailIds":{
        "include":[],
        "exclude":[],
        "domainFilter":true
    },
    "domains":{
        "include":[],
        "exclude":[],
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