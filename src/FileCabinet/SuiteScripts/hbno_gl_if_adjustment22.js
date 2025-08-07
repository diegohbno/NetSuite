/**
 * @NApiVersion 2.1
 * @NScriptType plugintype
 * @NModuleScope SameAccount
 */

define(['N/record', 'N/log', 'N/runtime'], (record, log, runtime) => {

    /**
     * Main function for Custom GL Lines Plugin
     * @param {Object} context
     * @param {Record} context.newRecord - New record
     * @param {Record} context.oldRecord - Old record (if available)
     * @param {string} context.type - Transaction type
     * @param {Array} context.standardLines - Array of standard GL lines
     * @returns {Array} Array of custom GL lines to add
     */
    const customizeGlImpact = (context) => {
        try {
            const { newRecord, oldRecord, type, standardLines } = context;

            log.debug('Plugin Triggered', `Transaction Type: ${type}, Record ID: ${newRecord.id}`);

            // Solo procesar Item Fulfillments
            if (type !== 'itemfulfillment') {
                return [];
            }

            // Obtener parámetros del script con valores por defecto
            const currentScript = runtime.getCurrentScript();
            const debitAccountId = currentScript.getParameter({ name: 'custscript_debit_account' }) || 907;
            const creditAccountId = currentScript.getParameter({ name: 'custscript_credit_account' }) || 54;

            // Verificar que el Item Fulfillment está siendo marcado como Fulfilled
            const currentStatus = newRecord.getValue('shipstatus');
            const previousStatus = oldRecord ? oldRecord.getValue('shipstatus') : null;

            log.debug('Status Check', `Previous: ${previousStatus}, Current: ${currentStatus}`);

            // Solo agregar líneas GL cuando cambie a 'C' (Shipped/Fulfilled)
            if (currentStatus !== 'C' || previousStatus === 'C') {
                log.debug('Status Condition Not Met', 'Item Fulfillment not changing to Fulfilled status');
                return [];
            }

            // Calcular el monto basado en las líneas estándar existentes
            const totalAmount = calculateAmountFromStandardLines(standardLines);

            if (totalAmount === 0) {
                log.debug('No Amount Found', 'Cannot determine amount from standard GL lines');
                return [];
            }

            // Crear las líneas GL personalizadas
            const customLines = createCustomGlLines(debitAccountId, creditAccountId, totalAmount, newRecord);

            log.audit('Custom GL Lines Created', {
                linesCount: customLines.length,
                totalAmount: totalAmount,
                debitAccount: debitAccountId,
                creditAccount: creditAccountId
            });

            return customLines;

        } catch (error) {
            log.error('customizeGlImpact Error', error.toString());
            return [];
        }
    };

    /**
     * Calcular monto total desde las líneas GL estándar
     * @param {Array} standardLines - Array de líneas GL estándar
     * @returns {number} Monto total
     */
    const calculateAmountFromStandardLines = (standardLines) => {
        let totalAmount = 0;

        try {
            if (!standardLines || standardLines.length === 0) {
                log.debug('No Standard Lines', 'No standard GL lines found');
                return 0;
            }

            // Sumar todos los débitos de las líneas estándar
            standardLines.forEach((line, index) => {
                const debitAmount = parseFloat(line.debitAmount) || 0;
                totalAmount += debitAmount;

                log.debug('Standard Line Analysis', {
                    lineIndex: index,
                    account: line.accountId,
                    debitAmount: debitAmount,
                    creditAmount: line.creditAmount
                });
            });

            log.debug('Amount Calculation', `Total amount from standard lines: ${totalAmount}`);

        } catch (error) {
            log.error('calculateAmountFromStandardLines Error', error.toString());
        }

        return totalAmount;
    };

    /**
     * Crear líneas GL personalizadas
     * @param {string} debitAccountId - ID de la cuenta de débito
     * @param {string} creditAccountId - ID de la cuenta de crédito
     * @param {number} amount - Monto para las líneas
     * @param {Record} fulfillmentRecord - Registro del Item Fulfillment
     * @returns {Array} Array de líneas GL personalizadas
     */
    const createCustomGlLines = (debitAccountId, creditAccountId, amount, fulfillmentRecord) => {
        const customLines = [];

        try {
            const subsidiary = fulfillmentRecord.getValue('subsidiary');
            const currency = fulfillmentRecord.getValue('currency') || 'USD';
            const department = fulfillmentRecord.getValue('department');
            const location = fulfillmentRecord.getValue('location');
            const classId = fulfillmentRecord.getValue('class');

            // Línea de débito
            const debitLine = {
                accountId: parseInt(debitAccountId),
                debitAmount: amount,
                creditAmount: 0,
                memo: `Custom GL - Item Fulfillment Debit`,
                subsidiary: subsidiary,
                currency: currency
            };

            // Agregar dimensiones si están disponibles
            if (department) debitLine.department = department;
            if (location) debitLine.location = location;
            if (classId) debitLine.class = classId;

            customLines.push(debitLine);

            // Línea de crédito
            const creditLine = {
                accountId: parseInt(creditAccountId),
                debitAmount: 0,
                creditAmount: amount,
                memo: `Custom GL - Item Fulfillment Credit`,
                subsidiary: subsidiary,
                currency: currency
            };

            // Agregar dimensiones si están disponibles
            if (department) creditLine.department = department;
            if (location) creditLine.location = location;
            if (classId) creditLine.class = classId;

            customLines.push(creditLine);

            log.debug('Custom Lines Created', {
                debitLine: debitLine,
                creditLine: creditLine
            });

        } catch (error) {
            log.error('createCustomGlLines Error', error.toString());
        }

        return customLines;
    };

    return {
        customizeGlImpact: customizeGlImpact
    };
});

/**
 * CONFIGURACIÓN DEL CUSTOM GL LINES PLUG-IN:
 *
 * 1. INSTALACIÓN:
 *    - Ve a Setup > Accounting > Custom GL Lines Plug-ins
 *    - Click "New" y sube este script
 *    - Configura los parámetros del script
 *
 * 2. PARÁMETROS DEL SCRIPT:
 *
 *    Parameter 1:
 *    - ID: custscript_debit_account
 *    - Label: Debit Account
 *    - Type: List/Record (Account)
 *    - Description: Account to be debited when Item Fulfillment is fulfilled
 *
 *    Parameter 2:
 *    - ID: custscript_credit_account
 *    - Label: Credit Account
 *    - Type: List/Record (Account)
 *    - Description: Account to be credited when Item Fulfillment is fulfilled
 *
 * 3. DEPLOYMENT:
 *    - Asigna el plug-in a Item Fulfillment transactions
 *    - Configura los valores de las cuentas en el deployment
 *    - Set Status to "Testing" initially, then "Released" after validation
 *
 * 4. TESTING:
 *    - Crea un Item Fulfillment de prueba
 *    - Cambia el status a "Fulfilled"
 *    - Verifica que las líneas GL personalizadas se agreguen correctamente
 *    - Revisa el GL impact en la transacción
 *
 * 5. VALIDACIÓN:
 *    - Confirma que los balances contables sean correctos
 *    - Verifica que no haya duplicación de líneas GL
 *    - Prueba con diferentes monedas y subsidiarias si aplica
 */