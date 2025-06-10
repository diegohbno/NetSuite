/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * This script was provided by Starling Solutions.
 *
 *  Version        Date               Author        Remarks
 *************************************************************************
 *  1.0         04 Sep 2019     	Mark Baker      			Initial Version
 *  1.1         10 Aug 2020     	Dimitry Mazur	STP-140 	CSV saved file functionality update
 *************************************************************************
 */


define(['N/ui/dialog'],

	function (dialog) {

		/**
		 * Function to be executed after page is initialized.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
		 *
		 * @since 2015.2
		 */
		function pageInit (scriptContext) {
			log.debug({ title : 'Page init on ' + scriptContext.mode, details : 'ID: ' + scriptContext.currentRecord.id });

		}


		/**
		 * Function to be executed when field is changed.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 * @param {string} scriptContext.fieldId - Field name
		 * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
		 * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
		 *
		 * @since 2015.2
		 */
		function fieldChanged (scriptContext) {
			log.debug({ title : 'Field changed', details : 'Sublist ID: ' + scriptContext.sublistId + ' - Field ID: ' + scriptContext.fieldId + ' - Line: ' + scriptContext.lineNum + ' - Column: ' + scriptContext.columnNum });

		}


		/**
		 * Function to be executed when field is slaved.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 * @param {string} scriptContext.fieldId - Field name
		 *
		 * @since 2015.2
		 */
		function postSourcing (scriptContext) {
			log.debug({ title : 'Post sourcing', details : 'Sublist ID: ' + scriptContext.sublistId + ' - Field ID: ' + scriptContext.fieldId });

		}


		/**
		 * Function to be executed after sublist is inserted, removed, or edited.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 *
		 * @since 2015.2
		 */
		function sublistChanged (scriptContext) {
			log.debug({ title : 'Sublist changed', details : 'Sublist ID: ' + scriptContext.sublistId });

		}


		/**
		 * Function to be executed after line is selected.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 *
		 * @since 2015.2
		 */
		function lineInit (scriptContext) {
			log.debug({ title : 'Line init', details : 'Sublist ID: ' + scriptContext.sublistId });

		}


		/**
		 * Validation function to be executed when field is changed.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 * @param {string} scriptContext.fieldId - Field name
		 * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
		 * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
		 *
		 * @returns {boolean} Return true if field is valid
		 *
		 * @since 2015.2
		 */
		function validateField (scriptContext) {
			log.debug({ title : 'Validate field', details : 'Sublist ID: ' + scriptContext.sublistId + ' - Field ID: ' + scriptContext.fieldId + ' - Line: ' + scriptContext.lineNum + ' - Column: ' + scriptContext.columnNum });

			return true;
		}


		/**
		 * Validation function to be executed when sublist line is committed.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 *
		 * @returns {boolean} Return true if sublist line is valid
		 *
		 * @since 2015.2
		 */
		function validateLine (scriptContext) {
			log.debug({ title : 'Validate line', details : 'Sublist ID: ' + scriptContext.sublistId });

			return true;
		}


		/**
		 * Validation function to be executed when sublist line is inserted.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 *
		 * @returns {boolean} Return true if sublist line is valid
		 *
		 * @since 2015.2
		 */
		function validateInsert (scriptContext) {
			log.debug({ title : 'Validate insert', details : 'Sublist ID: ' + scriptContext.sublistId });

			return true;
		}


		/**
		 * Validation function to be executed when record is deleted.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 *
		 * @returns {boolean} Return true if sublist line is valid
		 *
		 * @since 2015.2
		 */
		function validateDelete (scriptContext) {
			log.debug({ title : 'Validate delete', details : 'Sublist ID: ' + scriptContext.sublistId });

			return true;
		}


		/**
		 * Validation function to be executed when record is saved.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @returns {boolean} Return true if record is valid
		 *
		 * @since 2015.2
		 */
		function saveRecord (scriptContext) {
			var confirmed   = scriptContext.currentRecord.getValue({ fieldId : 'are_you_sure' });
			var folderId   	= scriptContext.currentRecord.getValue({ fieldId : 'custpage_folder' });

			if (!folderId) {
				dialog.alert({
					title   : 'Mass Delete Logs Folder missing',
					message : 'Please select a "Mass Delete Logs Folder". It can be any of the top folders in the file cabinet.'
				});
				return false;
			}

			if (!confirmed) {
				dialog.confirm({
					title   : 'Are you sure?',
					message : 'Proceeding will delete <b>ALL</b> results from this search. This <b>CANNOT BE UNDONE</b>.<br><br><b>ARE YOU SURE?</b>'
				}).then(function(isConfirmed) {
					if (isConfirmed) {
						scriptContext.currentRecord.setValue({ fieldId : 'are_you_sure', value : true });
						document.getElementById('submitter').click();
					}
				});
				return false;
			}
			else {
				return true;
			}
		}


		// Helper Functions

		return {
			// pageInit       : pageInit,
			// fieldChanged   : fieldChanged,
			// postSourcing   : postSourcing,
			// sublistChanged : sublistChanged,
			// lineInit       : lineInit,
			// validateField  : validateField,
			// validateLine   : validateLine,
			// validateInsert : validateInsert,
			// validateDelete : validateDelete,
			saveRecord     : saveRecord
		};

	});