/**
 * @NApiVersion 2.x
 * @NScriptType customglplugin
 */
define(function() {
    function customizeGlImpact(context) {
        var customLines = context.customLines;
        var amount = '100.00';

        var memo = context.transactionRecord.getValue({fieldId : 'memo'});
        var firstAccount = context.standardLines.getLine({index: 0}).accountId || 907;
        var secondAccount = context.standardLines.getLine({index: 1}).accountId || 54;
        var bookId = context.book.id;
        log.debug('context.standardLines.getLine({index: 0})',context.standardLines.getLine({index: 0}))

        var firstLine = customLines.addNewLine();
        firstLine.accountId = firstAccount;
        firstLine.creditAmount = amount;
        firstLine.memo = memo + ' for book ' + bookId;
        firstLine.isBookSpecific = false;

        var secondLine = customLines.addNewLine();
        secondLine.accountId = secondAccount;
        secondLine.debitAmount = amount;
        secondLine.memo = memo + ' for book ' + bookId;
        secondLine.isBookSpecific = false;
    }

    return {
        customizeGlImpact: customizeGlImpact,
    }
}); 

        