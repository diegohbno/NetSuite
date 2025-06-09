/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/log'], function(log) {

  /**
   * This is the entry point for the client script.
   */
  function pageInit(context) {
    // Event handler for the export button
    var exportButton = document.getElementById('custpage_export_button');
    if (exportButton) {
      exportButton.addEventListener('click', exportSublistToCSV);
    }
  }

  /**
   * Export the sublist data to CSV when the "Export to Excel" button is clicked.
   */
  function exportSublistToCSV() {
    try {
      var sublistData = JSON.parse(document.getElementById('custpage_sublist_data').value);
      if (!sublistData || sublistData.length === 0) {
        alert('No data available to export!');
        return;
      }

      // Prepare CSV content
      var headers = ['Work Order', 'Customer', 'From Status', 'To Status', 'Changed On', 'Interval (Hours)'];
      var csvString = headers.join(',') + '\n';

      sublistData.forEach(function(row) {
        csvString += [row.wo_id, row.customer, row.status_from, row.status_to, row.changed_on, row.interval_hours].join(',') + '\n';
      });

      // Trigger the CSV file download
      downloadCSV(csvString);

    } catch (error) {
      log.error('Export Error', error);
      alert('An error occurred while exporting the data.');
    }
  }

  // Function to trigger the CSV download
  function downloadCSV(csvString) {
    var blob = new Blob([csvString], { type: 'text/csv' });
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'Work_Order_Status_Timeline.csv';
    link.click();
  }

  return {
    pageInit: pageInit
  };
});
