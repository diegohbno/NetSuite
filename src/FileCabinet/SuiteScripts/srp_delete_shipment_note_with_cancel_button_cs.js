/**
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 */
define(['N/currentRecord', 'N/record', 'N/ui/dialog', 'N/url', 'N/runtime'], 
  function(currentRecord, record, dialog, url, runtime) {
  
      let isOverridden = false;
      let observer = null;
      let retryCount = 0;
      const MAX_RETRIES = 20;
  
      function pageInit(context) {
          try {
              console.log('PageInit called, context mode:', context.mode);
              
              // Wait for NetSuite UI to fully load
              setTimeout(() => {
                  initializeCancelOverride();
              }, 100);
              
          } catch (e) {
              console.error('Error in pageInit:', e);
          }
      }
      
      function initializeCancelOverride() {
          // Strategy 1: Try immediate override
          if (overrideCancelButton()) {
              return;
          }
          
          // Strategy 2: Use MutationObserver
          startObserving();
          
          // Strategy 3: Retry mechanism
          const retryInterval = setInterval(() => {
              retryCount++;
              
              if (isOverridden || retryCount >= MAX_RETRIES) {
                  clearInterval(retryInterval);
                  if (retryCount >= MAX_RETRIES && !isOverridden) {
                      console.warn('Failed to override cancel button after maximum retries');
                  }
                  return;
              }
              
              console.log(`Retry attempt ${retryCount} to override cancel button`);
              overrideCancelButton();
          }, 250);
      }
  
      function startObserving() {
          if (observer) return;
          
          observer = new MutationObserver((mutations) => {
              if (isOverridden) return;
              
              let shouldCheck = false;
              mutations.forEach((mutation) => {
                  if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                      // Check if any added nodes contain buttons or are button containers
                      mutation.addedNodes.forEach(node => {
                          if (node.nodeType === Node.ELEMENT_NODE) {
                              if (node.id === '_cancel' || 
                                  node.querySelector && node.querySelector('#_cancel')) {
                                  shouldCheck = true;
                              }
                          }
                      });
                  }
              });
              
              if (shouldCheck) {
                  setTimeout(overrideCancelButton, 50);
              }
          });

          observer.observe(document.body, {
              childList: true,
              subtree: true
          });
      }
  
      function overrideCancelButton() {
          try {
              // Try multiple selectors for cancel button
              let cancelButton = document.getElementById('_cancel');
              
              if (!cancelButton) {
                  // Try alternative selectors
                  cancelButton = document.querySelector('input[id="_cancel"]') ||
                               document.querySelector('input[value="Cancel"]') ||
                               document.querySelector('a[onclick*="cancel"]') ||
                               document.querySelector('input[onclick*="cancel"]');
              }
              
              if (!cancelButton) {
                  console.log('Cancel button not found');
                  return false;
              }
              
              // Check if already overridden
              if (cancelButton.hasAttribute('data-custom-override')) {
                  isOverridden = true;
                  return true;
              }
              
              console.log('Found cancel button:', cancelButton);
              console.log('Button type:', cancelButton.tagName, 'ID:', cancelButton.id);
              
              // Mark as overridden first
              cancelButton.setAttribute('data-custom-override', 'true');
              
              // Store original handlers
              const originalOnClick = cancelButton.onclick;
              const originalHref = cancelButton.href;
              
              // Handle different button types
              if (cancelButton.tagName.toLowerCase() === 'input') {
                  // Input button
                  cancelButton.onclick = function(e) {
                      handleCancelClick(e, originalOnClick, originalHref);
                  };
              } else if (cancelButton.tagName.toLowerCase() === 'a') {
                  // Anchor/link
                  cancelButton.href = 'javascript:void(0)';
                  cancelButton.onclick = function(e) {
                      handleCancelClick(e, originalOnClick, originalHref);
                  };
              }
              
              // Also add event listener as backup
              cancelButton.addEventListener('click', function(e) {
                  if (!e.defaultPrevented) {
                      handleCancelClick(e, originalOnClick, originalHref);
                  }
              }, true);
              
              isOverridden = true;
              
              // Stop observing once successfully overridden
              if (observer) {
                  observer.disconnect();
                  observer = null;
              }
              
              console.log('Cancel button successfully overridden');
              return true;
              
          } catch (e) {
              console.error('Error overriding cancel button:', e);
              return false;
          }
      }
      
      function handleCancelClick(event, originalOnClick, originalHref) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          
          try {
              handleCustomCancel(originalOnClick, originalHref);
          } catch (error) {
              console.error('Error in custom cancel handler:', error);
              executeOriginalCancel(originalOnClick, originalHref);
          }
      }
      
      async function handleCustomCancel(originalOnClick, originalHref) {
          try {
              const currentRec = currentRecord.get();
              
              if (!currentRec) {
                  console.log('No current record found, executing original cancel');
                  executeOriginalCancel(originalOnClick, originalHref);
                  return;
              }
              
              const recordId = currentRec.id;
              const recordType = currentRec.type;
              
              console.log('Record ID:', recordId, 'Type:', recordType);
              
              let inventoryAdjustment = null;
              let releaseOrder = null;
              
              // Get inventory adjustment field
              try {
                  inventoryAdjustment = currentRec.getValue({
                      fieldId: 'custbody_srp_linked_inventory_adj'
                  });
                  console.log('Inventory adjustment:', inventoryAdjustment);
              } catch (e) {
                  console.warn('Could not get inventory adjustment field:', e);
              }

              // Get release order field - fixed field ID
              try {
                  releaseOrder = currentRec.getValue({
                      fieldId: 'custbodycustbody159'
                  });
                  console.log('Release order value:', releaseOrder);
              } catch (e) {
                  console.warn('Could not get release order field:', e);
              }

              // Only proceed with deletion if this is an existing record without inventory adjustment
              if (recordId && !inventoryAdjustment) {
                  console.log('Existing record without inventory adjustment - showing delete confirmation');
                  
                  const confirmed = await dialog.confirm({
                      title: 'Confirm Cancel',
                      message: 'If you cancel, all unsaved data will be lost. Do you still want to cancel?'
                  });

                  if (confirmed) {
                      try {
                          console.log('Deleting record...');
                          
                          await record.delete({
                              type: recordType,
                              id: recordId
                          });
                          
                          console.log('Record deleted successfully');
                          
                          // Navigate appropriately
                          handlePostDeleteNavigation(releaseOrder);
                          
                      } catch (deleteError) {
                          console.error('Delete failed:', deleteError);
                          
                          await dialog.alert({
                              title: 'Delete Error',
                              message: 'Failed to delete record: ' + (deleteError.message || deleteError.toString())
                          });
                          
                          // Stay on current page after error
                          return;
                      }
                  }
                  // If not confirmed, do nothing (stay on page)
              } else {
                  console.log('New record or has inventory adjustment - executing original cancel');
                  executeOriginalCancel(originalOnClick, originalHref);
              }
              
          } catch (error) {
              console.error('Error in handleCustomCancel:', error);
              executeOriginalCancel(originalOnClick, originalHref);
          }
      }
      
      function handlePostDeleteNavigation(releaseOrder) {
          try {
              // Try to navigate back in history first
              if (window.history.length > 1) {
                  console.log('Navigating back in history');
                  window.history.back();
                  return;
              }
              
              // If no history and we have a release order, navigate to it
              if (releaseOrder) {
                  console.log('No history, navigating to release order:', releaseOrder);
                  
                  // Try different record types for release order
                  const recordTypes = ['salesorder', 'purchaseorder', 'transferorder', 'workorder'];
                  
                  // Try the most common first
                  try {
                      const recordUrl = url.resolveRecord({
                          recordType: 'salesorder',
                          recordId: releaseOrder,
                          isEditMode: false
                      });
                      window.location.href = recordUrl;
                      return;
                  } catch (urlError) {
                      console.warn('Failed to create URL for salesorder, trying manual construction');
                      window.location.href = '/app/accounting/transactions/salesord.nl?id=' + releaseOrder;
                      return;
                  }
              }
              
              // Fallback to search results
              console.log('No release order or history, navigating to search');
              window.location.href = '/app/common/search/searchresults.nl';
              
          } catch (navError) {
              console.error('Navigation error:', navError);
              // Ultimate fallback
              window.location.href = '/app/center/card.nl';
          }
      }
      
      function executeOriginalCancel(originalOnClick, originalHref) {
          try {
              console.log('Executing original cancel behavior');
              
              if (originalOnClick) {
                  console.log('Calling original onclick handler');
                  originalOnClick.call(document.getElementById('_cancel'));
              } else if (originalHref) {
                  console.log('Navigating to original href:', originalHref);
                  window.location.href = originalHref;
              } else {
                  console.log('No original handlers, using fallback navigation');
                  // Fallback navigation
                  if (window.history.length > 1) {
                      window.history.back();
                  } else {
                      window.location.href = '/app/common/search/searchresults.nl';
                  }
              }
          } catch (error) {
              console.error('Error executing original cancel:', error);
              // Ultimate fallback
              if (window.history.length > 1) {
                  window.history.back();
              } else {
                  window.location.href = '/app/center/card.nl';
              }
          }
      }
      
      function pageUnload() {
          if (observer) {
              observer.disconnect();
              observer = null;
          }
      }
  
      return {
          pageInit: pageInit,
          pageUnload: pageUnload
      };
  });