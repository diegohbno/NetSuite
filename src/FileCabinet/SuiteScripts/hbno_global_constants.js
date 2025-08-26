/**
 *@NApiVersion 2.1
 *@NModuleScope Public
 */

define(["N/runtime"], function (runtime) {
  const COMMON = {
    ID: "id",
    DATE_FORMAT: "DD/MM/YYYY",
    NS_TIME_FORMAT: "HH12:MI:SS AM",
    INTERNAL_ID: "internalid",
    EXTERNAL_ID: "externalid",
    TRAN_ID: "tranid",
    DATE: 'trandate',
    SUBSIDIARY: 'subsidiary',
    CUSTOMER: "entity",
    QUANTITY: 'quantity',
    CUSTOMER_ID: 'entityid',
    COMPANY_NAME: 'companyname',
    SHIPPING_COUNTRY: "shipping_country",
    IS_INACTIVE: "isinactive",
    CREATED_DATE: "datecreated",
    LAST_MODIFIED_DATE: "lastmodifieddate",
    ITEM: 'item',
    LOCATION: 'location',
    START_DATE: 'startdate',
    END_DATE: 'enddate',
    PARENT: 'parent',
    NAME: "name",
    PERIOD_NAME: 'periodname',
    LINE: 'line',
    DEBIT: 'debit',
    CREDIT: 'credit',
    ACCOUNT: 'account',
    RATE: 'rate',
    POSTING_PERIOD: 'postingperiod',
    EXCHANGE_RATE: 'exchangerate',
    CURRENCY: 'currency',
    CUSTOM_FORM: 'customform',
    ACCOUNTING_PERIOD: 'accountingperiod',
    MEMO: 'memo',
    SERIAL_NO: 'serialnumber',
    SEARCH: {
      GROUP: "GROUP",
      CONTAINS: "contains",
      AND: "AND",
      ANY_OF: "anyof",
      IS: "is",
      TYPE: "type",
      FALSE: "F",
      TRUE: "T",
      WITH_IN: "within",
      THIS_MONTH: "thismonth",
      MAINLINE: "mainline",
      SHIPPING: "shipping",
      TAXLINE: "taxline",
      COGS: "cogs",
      NONEOF: "noneof",
      GREATER_THAN: "greaterthan",
      NONE: '@NONE@'
    },
  };

  const PRINTERS_RECORD = {
    RECORD_TYPE: 'customrecord_srp_hbno_printers_rec',
    NAME: 'name'
  };

  const LABELS_RECORD = {
    RECORD_TYPE: 'customrecord_srp_hbno_labels_rec',
    NAME: 'name',
    TYPE: 'custrecord_srp_labels_record_type',
    MAPPING: 'custrecord_srp_labels_record_mapping',
    SIZE: 'custrecord_srp_labels_record_size'
  };

  const LABEL_MAPPING_RECORD = {
    RECORD_TYPE: 'customrecord_srp_hbno_label_mapping_rec',
    NAME: 'name',
    SEQUENCE: 'custrecord_srp_hbno_label_map_sequence',
    INTERNAL_ID: 'custrecord_srp_hbno_label_map_internalid',
    LABEL: 'custrecord_srp_hbno_label_map_label'
  };

  const SHIPPING_LABEL_DATA_RECORD = {
    RECORD_TYPE: 'customrecord_srp_label_integrat_data_rec',
    JOB_ID: 'custrecord_srp_label_resp_data_job_id',
    LABEL: 'custrecord_srp_label_resp_data_label_id',
    PRINTER: 'custrecord_srp_label_resp_data_printer',
    RESPONSE: 'custrecord_srp_label_resp_data_response'
  }

  const API = {
    BASE_URL: 'http://98.81.113.107:5001/api/v1/'
  }

  const API_METHODS = {
    JOBS: API.BASE_URL+'jobs',
    FILES: API.BASE_URL+'files'
  }
  
  const SUITELET_SCRIPT = {
    SCRIPT_ID: 'customscript_srp_sl_attach_label',
    DEPLOYMENT_ID: 'customdeploy_srp_sl_attach_label'
  }

  const HAZARD_STATEMENTS_IDS = {
    H226:'custitem_srp_hbno_item_hazard_h226',
    H227: 'custitem_srp_hbno_item_hazard_h227',
    H302: 'custitem_srp_hbno_item_hazard_h302',
    H303: 'custitem_srp_hbno_item_hazard_h303',
    H304: 'custitem_srp_hbno_item_hazard_h304',
    H305: 'custitem_srp_hbno_item_hazard_h305',
    H310: 'custitem_srp_hbno_item_hazard_h310',
    H311: 'custitem_srp_hbno_item_hazard_h311',
    H312: 'custitem_srp_hbno_item_hazard_h312',
    H313: 'custitem_srp_hbno_item_hazard_h313',
    H314: 'custitem_srp_hbno_item_hazard_h314',
    H315: 'custitem_srp_hbno_item_hazard_h315',
    H316: 'custitem_srp_hbno_item_hazard_h316',
    H317: 'custitem_srp_hbno_item_hazard_h317',
    H318: 'custitem_srp_hbno_item_hazard_h318',
    H319: 'custitem_srp_hbno_item_hazard_h319',
    H320: 'custitem_srp_hbno_item_hazard_h320',
    H330: 'custitem_srp_hbno_item_hazard_h330',
    H332: 'custitem_srp_hbno_item_hazard_h332',
    H335: 'custitem_srp_hbno_item_hazard_h335',
    H341: 'custitem_srp_hbno_item_hazard_h341',
    H350: 'custitem_srp_hbno_item_hazard_h350',
    H351: 'custitem_srp_hbno_item_hazard_h351',
    H361: 'custitem_srp_hbno_item_hazard_h361',
    H371: 'custitem_srp_hbno_item_hazard_h371',
    H400: 'custitem_srp_hbno_item_hazard_h400',
    H401: 'custitem_srp_hbno_item_hazard_h401',
    H402: 'custitem_srp_hbno_item_hazard_h402',
    H410: 'custitem_srp_hbno_item_hazard_h410',
    H412: 'custitem_srp_hbno_item_hazard_h412',
    RSL153: 'custitem_srp_hbno_item_hazard_rsl53',
    R43: 'custitem_srp_hbno_item_hazard_r43',
    R41: 'custitem_srp_hbno_item_hazard_r41',
    R38: 'custitem_srp_hbno_item_hazard_r38'
  }
  
  const PRECAUTIONARY_STATEMENTS_IDS = {
    P101: 'custitem_srp_hbno_item_precau_p101',
    P102: 'custitem_srp_hbno_item_precau_p102',
    P103: 'custitem_srp_hbno_item_precau_p103',
    P201: 'custitem_srp_hbno_item_precau_p201',
    P202: 'custitem_srp_hbno_item_precau_p202',
    P210: 'custitem_srp_hbno_item_precau_p210',
    P261: 'custitem_srp_hbno_item_precau_p261',
    P264: 'custitem_srp_hbno_item_precau_p264',
    P270: 'custitem_srp_hbno_item_precau_p270',
    P271: 'custitem_srp_hbno_item_precau_p271',
    P272: 'custitem_srp_hbno_item_precau_p272',
    P273: 'custitem_srp_hbno_item_precau_p273',
    P280: 'custitem_srp_hbno_item_precau_p280',
    P321: 'custitem_srp_hbno_item_precau_p321',
    P330: 'custitem_srp_hbno_item_precau_p330',
    P331: 'custitem_srp_hbno_item_precau_p331',
    P233: 'custitem_srp_hbno_item_precau_p233',
    P235: 'custitem_srp_hbno_item_precau_p235',
    P240: 'custitem_srp_hbno_item_precau_p240',
    P241: 'custitem_srp_hbno_item_precau_p241',
    P242: 'custitem_srp_hbno_item_precau_p242',
    P243: 'custitem_srp_hbno_item_precau_p243',
    P260: 'custitem_srp_hbno_item_precau_p260',
    P281: 'custitem_srp_hbno_item_precau_p281',
    P301: 'custitem_srp_hbno_item_precau_p301',
    P303: 'custitem_srp_hbno_item_precau_p303',
    P308: 'custitem_srp_hbno_item_precau_p308',
    P310: 'custitem_srp_hbno_item_precau_p310',
    P333: 'custitem_srp_hbno_item_precau_p333',
    P362: 'custitem_srp_hbno_item_precau_p362',
    P363: 'custitem_srp_hbno_item_precau_p363',
    P370: 'custitem_srp_hbno_item_precau_p370',
    P378: 'custitem_srp_hbno_item_precau_p378',
    P391: 'custitem_srp_hbno_item_precau_p391',
    P405: 'custitem_srp_hbno_item_precau_p405',
    P501: 'custitem_srp_hbno_item_precau_p501'
  }

  return {
    COMMON,
    API_METHODS,
    SUITELET_SCRIPT,
    PRINTERS_RECORD,
    LABELS_RECORD,
    LABEL_MAPPING_RECORD,
    SHIPPING_LABEL_DATA_RECORD,
    HAZARD_STATEMENTS_IDS,
    PRECAUTIONARY_STATEMENTS_IDS
  };
});
