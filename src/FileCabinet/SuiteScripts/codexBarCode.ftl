<pdf>
  <head>
    <style type="text/css">
      @page {
        size: 1in 2.125in;
        margin: 0.05in;
      }
    </style>
  </head>
  <body style="margin:0; padding:0; font-family:Arial, sans-serif;">
    <table width="100%" height="100%" border="0" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" valign="middle">
          <table border="0" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center">
                <barcode codetype="code128" showtext="false" value="${data.barcodeValue!''}"/>
              </td>
            </tr>
            <tr><td height="5"></td></tr> <!-- espacio entre barcode y texto -->
            <tr>
              <td align="center">
                <font size="1">${data.barcodeValue!''}</font>
              </td>
            </tr>
            <tr><td height="3"></td></tr> <!-- espacio entre líneas -->
            <tr>
              <td align="center">
                <font size="2"><b>${data.description!''}</b></font>
              </td>
            </tr>
            <tr><td height="3"></td></tr>
            <tr>
              <td>
                <font size="1">${data.statusText!''}</font>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</pdf>
