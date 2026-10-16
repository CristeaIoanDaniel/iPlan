import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
class ApiClient {
  static const String baseUrl = 'http://localhost:3000/api';
  final _storage = const FlutterSecureStorage();
  Future<Map<String,String>> _getHeaders() async{
    String? token = await _storage.read(key:'jwt_token');
    return{
      'Content-Type' :'application/json',
      if(token !=null ) 'Authorization' : 'Bearer $token',
    };
  }
  Future<http.Response> post(String endpoint, Map<String,dynamic> body) async{
    final headers = await _getHeaders();
    return http.post(
      Uri.parse('$baseUrl$endpoint'),
      headers : headers,
      body :jsonEncode(body),
    );
  }
  Future<http.Response> get(String endpoint) async{
    final headers = await _getHeaders();
    return http.get(
      Uri.parse('$baseUrl$endpoint'),
      headers : headers,
    );
  }
}