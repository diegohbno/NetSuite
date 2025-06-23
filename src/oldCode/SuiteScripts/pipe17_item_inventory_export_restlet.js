/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 * @NModuleScope SameAccount
 */

define(['N/search', 'N/log', 'N/query'], 
(search, log, query) => {
    const getItems = () => {
        try {
            let queryStr = 
            `SELECT
                id,
                itemId,
                displayName,
                itemId || ' ' || displayName,
                SUM(inv.quantityonhand)
            FROM item
                LEFT JOIN itemInventoryBalance inv ON inv.item = item.id
            WHERE
                cseg2 IN (10, 25)
                AND isInactive = 'F'
            GROUP BY
                id,
                itemId,
                displayName,
                itemId || ' ' || displayName`;

            let queryResults = query.runSuiteQL({query: queryStr}).results;
            let totalResults = queryResults.length;
            log.debug('totalResults', totalResults);
            // log.debug('queryResults', queryResults);

            let results = [];
            queryResults.forEach(result => {
                let item = result.values;
                results.push({
                    id: item[0],
                    name: item[1],
                    displayName: item[2],
                    fullName: item[3],
                    quantityOnHand: item[4],
                });
            })


            // var itemSearchObj = search.create({
            //     type: "item",
            //     filters: [
            //         ["cseg2", "anyof", "10", "25"],
            //         "AND",
            //         ["isinactive", "is", "F"],
            //         "AND",
            //         ["displayname", "startswith", ""]
            //     ],
            //     columns: [
            //         search.createColumn({ name: "internalid" }),
            //         search.createColumn({ name: "itemid" }),
            //         search.createColumn({ name: "displayname" }),
            //         search.createColumn({ name: "custitem7" }),
            //         search.createColumn({ name: "quantityonhand" })
            //     ]
            // });

            // var results = [];
            // var pagedData = itemSearchObj.runPaged({ pageSize: 1000 });
            // var totalResults = 0;

            // log.debug("Search Result Pages", pagedData.pageRanges.length);

            // pagedData.pageRanges.forEach(function(pageRange) {
            //     var page = pagedData.fetch({ index: pageRange.index });
            //     page.data.forEach(function(result) {
            //         results.push({
            //             id: result.getValue({ name: "internalid" }),
            //             name: result.getValue({ name: "itemid" }),
            //             displayName: result.getValue({ name: "displayname" }),
            //             fullName: result.getValue({ name: "custitem7" }),
            //             quantityOnHand: result.getValue({ name: "quantityonhand" })
            //         });
            //         totalResults++;
            //     });
            // });

            // log.debug("Total Items Found", totalResults);

            return JSON.stringify({
                success: true,
                count: totalResults,
                data: results
            });

        } catch (e) {
            log.error("RESTlet Error", e);
            return JSON.stringify({
                success: false,
                message: e.message || e.toString()
            });
        }
    }

    return {get: getItems};
});