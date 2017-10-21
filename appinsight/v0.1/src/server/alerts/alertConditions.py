
NUMERIC_CONDITIONS = [ {'alertName' : 'numbytes GT 0',
                       'description' : '',
                       'searchCollection' : '8961ff9f-452e-4511-a022-c15878321499', 
                       'docType' : 'apacheAccess', 
                       'tsField' : '@timestamp',
                       'field' : 'bytes',
                       'statistic' : 'max',
                       'threshold' : 0,
                       'condition' : ''}
                       ]



TERM_CONDITIONS = [ {   'alertName' : 'count option 3 in Java docs',
                        'description' : '',
                        'searchCollection' : '8961ff9f-452e-4511-a022-c15878321499',
                        'docType' : 'Java',
                        'tsField' : '@timestamp',
                        'field' : 'message',
                        'searchTerm' : 'option',
                        'statistic' : 'doc_count',
                        'threshold' : 0,
                        'condition' : '>'}
                    ]
'''
TERM_CONDITIONS = [  {  'alertName' : '404 http status',
                        'description' : '',
                        'searchCollection' : '8961ff9f-452e-4511-a022-c15878321499',
                        'docType' : 'apacheAccess',
                        'tsField' : '@timestamp',
                        'field' : 'message',
                        'statistic' : 'doc_count',
                        'fieldKey' : 'max',
                        'threshold' : 0 }
                     ]
'''


                      
    
                       
                       
                       
