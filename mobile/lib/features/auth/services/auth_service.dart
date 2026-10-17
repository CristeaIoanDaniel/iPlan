import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter/foundation.dart';
import '../../../core/network/api_client.dart';

class AuthService {
  final ApiClient _apiClient = ApiClient();
  final _storage = const FlutterSecureStorage();

  Future<bool> login(String email, String password) async {
    try {
      final response = await _apiClient.post('/auth/login', {
        'email': email,
        'password': password,
      });
      if (response.statusCode == 200) {
        final body = Map<String, dynamic>.from(jsonDecode(response.body) as Map);
        final data = Map<String, dynamic>.from(body['data'] as Map);
        String token = data['token'] as String;
        await _storage.write(key: 'jwt_token', value: token);
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Login error : $e');
      return false;
    }
  }

  Future<void> logout() async {
    await _storage.delete(key: 'jwt_token');
  }

  Future<bool> isLoggedIn() async {
    String? token = await _storage.read(key: 'jwt_token');
    return token != null;
  }
}
